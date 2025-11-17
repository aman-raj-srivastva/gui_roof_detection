const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PythonShell } = require('python-shell');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/results', express.static('results'));

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const resultsDir = path.join(__dirname, 'results');

[uploadsDir, resultsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// WebSocket server for progress updates
const wss = new WebSocket.Server({ port: 8080 });

// Store active connections
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  ws.on('close', () => {
    clients.delete(clientId);
  });
  
  ws.send(JSON.stringify({ type: 'connected', clientId }));
});

// Broadcast progress to all clients
function broadcastProgress(type, data) {
  const message = JSON.stringify({ type, ...data });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Run Python inference script
function runInference(imagePath, resultId, callback) {
  const modelPath = path.join(__dirname, '..', 'best.pt');
  const outputPath = path.join(resultsDir, `${resultId}.jpg`);
  
  const options = {
    mode: 'text',
    pythonPath: 'python',
    pythonOptions: ['-u'],
    scriptPath: path.join(__dirname, 'scripts'),
    args: [modelPath, imagePath, outputPath]
  };

  const pyshell = new PythonShell('inference.py', options);
  
  pyshell.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'progress') {
        broadcastProgress('processing', { progress: data.progress, message: data.message });
      }
    } catch (e) {
      // Not JSON, just log it
      console.log(message);
    }
  });

  pyshell.on('error', (error) => {
    console.error('Python error:', error);
    callback(error, null);
  });

  pyshell.end((err) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, outputPath);
    }
  });
}

// Upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const resultId = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const imagePath = req.file.path;

    // Broadcast upload complete
    broadcastProgress('upload', { progress: 100, message: 'Upload complete' });

    // Start inference
    broadcastProgress('processing', { progress: 0, message: 'Initializing model...' });

    runInference(imagePath, resultId, (error, outputPath) => {
      if (error) {
        return res.status(500).json({ error: 'Inference failed', details: error.message });
      }

      const resultUrl = `/results/${path.basename(outputPath)}`;
      const inputUrl = `/uploads/${path.basename(imagePath)}`;

      broadcastProgress('complete', { 
        progress: 100, 
        message: 'Processing complete',
        resultId,
        inputUrl,
        resultUrl
      });

      res.json({
        success: true,
        resultId,
        inputUrl,
        resultUrl,
        message: 'Image processed successfully'
      });
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Save results endpoint
app.post('/api/save', (req, res) => {
  try {
    const { resultId, inputUrl, resultUrl } = req.body;
    
    if (!resultId || !resultUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Create a results info file
    const infoPath = path.join(resultsDir, `${resultId}_info.json`);
    const info = {
      resultId,
      inputUrl,
      resultUrl,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));

    res.json({
      success: true,
      message: 'Results saved successfully',
      infoPath: `/results/${path.basename(infoPath)}`
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Save failed', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on port 8080`);
});


