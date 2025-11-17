import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import ImageUploader from './components/ImageUploader';
import ProgressBar from './components/ProgressBar';
import ImageViewer from './components/ImageViewer';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [inputImage, setInputImage] = useState(null);
  const [outputImage, setOutputImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultId, setResultId] = useState(null);
  const wsRef = useRef(null);

  const handleLogin = (email) => {
    setIsAuthenticated(true);
    setUserEmail(email);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserEmail('');
    handleReset();
  };

  useEffect(() => {
    // Connect to WebSocket for progress updates
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'upload') {
        setUploadProgress(data.progress);
      } else if (data.type === 'processing') {
        setProcessingProgress(data.progress);
        setProcessingMessage(data.message || '');
        setIsProcessing(true);
      } else if (data.type === 'complete') {
        setProcessingProgress(100);
        setProcessingMessage('Processing complete!');
        setIsProcessing(false);
        if (data.resultUrl) {
          setOutputImage(`${API_BASE_URL}${data.resultUrl}`);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleImageUpload = async (file) => {
    try {
      setUploadProgress(0);
      setProcessingProgress(0);
      setProcessingMessage('');
      setOutputImage(null);
      setIsProcessing(false);
      
      // Create preview of input image
      const reader = new FileReader();
      reader.onload = (e) => {
        setInputImage(e.target.result);
      };
      reader.readAsDataURL(file);

      // Upload file
      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        setResultId(response.data.resultId);
        if (response.data.resultUrl) {
          setOutputImage(`${API_BASE_URL}${response.data.resultUrl}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const handleSaveResults = async () => {
    if (!resultId || !outputImage) {
      alert('No results to save');
      return;
    }

    // Use default filename
    const filename = `roof-detection-result-${resultId}.jpg`;

    try {
      // Download the output image
      const response = await fetch(outputImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Also save metadata to backend
      try {
        await axios.post(`${API_BASE_URL}/api/save`, {
          resultId,
          inputUrl: inputImage,
          resultUrl: outputImage,
        });
      } catch (error) {
        console.error('Metadata save error:', error);
        // Don't show error to user as image download succeeded
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save image. Please try again.');
    }
  };

  const handleReset = () => {
    setUploadProgress(0);
    setProcessingProgress(0);
    setProcessingMessage('');
    setInputImage(null);
    setOutputImage(null);
    setIsProcessing(false);
    setResultId(null);
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <div className="header-content">
            <div>
              <h1>🏠 Roof Detection AI</h1>
              <p>Upload an image to detect roofs using YOLOv11 Segmentation</p>
            </div>
            <div className="user-info">
              <span className="user-email">{userEmail}</span>
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="main-content">
          {!(inputImage || outputImage) && (
            <div className="upload-section">
              <ImageUploader onImageUpload={handleImageUpload} disabled={isProcessing} />
            </div>
          )}

          {(uploadProgress > 0 && uploadProgress < 100) && (
            <div className="upload-section">
              <ProgressBar 
                progress={uploadProgress} 
                label="Upload Progress" 
                className="upload-progress"
              />
            </div>
          )}

          {isProcessing && (
            <div className="processing-section">
              <ProgressBar 
                progress={processingProgress} 
                label="AI Processing" 
                className="processing-progress"
              />
              {processingMessage && (
                <p className="processing-message">{processingMessage}</p>
              )}
            </div>
          )}

          {!isProcessing && (inputImage || outputImage) && (
            <div className="results-section">
              <div className="results-header">
                <h2>Results</h2>
                <div className="results-actions">
                  {outputImage && (
                    <button 
                      className="save-button" 
                      onClick={handleSaveResults}
                    >
                      💾 Save Results
                    </button>
                  )}
                  <button 
                    className="reset-button" 
                    onClick={handleReset}
                  >
                    🔄 Reset
                  </button>
                </div>
              </div>
              
              <div className="images-container">
                {inputImage && (
                  <div className="image-panel">
                    <h3>Input Image</h3>
                    <ImageViewer imageUrl={inputImage} />
                  </div>
                )}
                
                {outputImage && (
                  <div className="image-panel">
                    <h3>Output Image</h3>
                    <ImageViewer imageUrl={outputImage} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;


