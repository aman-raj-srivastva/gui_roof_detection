# Roof Detection GUI - YOLOv11 Segmentation

A modern web application for roof detection using YOLOv11 segmentation model. Features a beautiful React frontend with real-time progress tracking and an Express.js backend for model inference.

## Features

- 🖼️ **Image Upload**: Drag & drop or click to upload images
- 📊 **Progress Tracking**: Real-time upload and AI processing progress
- 🎨 **Side-by-Side Display**: View input and output images simultaneously
- 🔍 **Zoom Controls**: Zoom in/out and pan images for detailed inspection
- 💾 **Save Results**: Save processed results to file
- 🎯 **Modern UI**: Beautiful gradient design with smooth animations

## Prerequisites

- Node.js (v14 or higher)
- Python 3.8 or higher
- pip (Python package manager)
- YOLOv11 model file (`best.pt`) in the root directory

## Installation

### 1. Install Python Dependencies

```bash
pip install ultralytics opencv-python torch torchvision
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

## Running the Application

### 1. Start the Backend Server

```bash
cd backend
npm start
```

The backend server will run on `http://localhost:5000` and WebSocket server on `ws://localhost:8080`

### 2. Start the Frontend

In a new terminal:

```bash
cd frontend
npm start
```

The frontend will open automatically at `http://localhost:3000`

## Usage

1. **Upload Image**: Drag and drop an image or click the upload area
2. **Monitor Progress**: Watch the upload and processing progress bars
3. **View Results**: See input and output images side by side
4. **Zoom & Pan**: Use the zoom controls to inspect details
5. **Save Results**: Click "Save Results" to save the processed image

## Project Structure

```
gui/
├── backend/
│   ├── server.js          # Express server
│   ├── scripts/
│   │   └── inference.py   # Python inference script
│   ├── uploads/           # Uploaded images (auto-created)
│   └── results/           # Processed results (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main app component
│   │   ├── components/    # React components
│   │   └── ...
│   └── public/
├── best.pt                # YOLOv11 model file
└── README.md
```

## API Endpoints

- `POST /api/upload` - Upload image for processing
- `POST /api/save` - Save results to file
- `GET /api/health` - Health check
- `WebSocket ws://localhost:8080` - Real-time progress updates

## Configuration

You can modify the API URL in `frontend/src/App.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
```

Or set it via environment variable:

```bash
REACT_APP_API_URL=http://your-server:5000 npm start
```

## Troubleshooting

### Python/Model Issues
- Ensure `best.pt` is in the root directory
- Verify Python dependencies are installed correctly
- Check that the model file is compatible with YOLOv11

### Connection Issues
- Ensure backend is running before starting frontend
- Check that ports 5000 and 8080 are not in use
- Verify CORS settings if accessing from different domains

## License

MIT



