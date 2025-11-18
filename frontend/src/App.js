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
  const [segments, setSegments] = useState([]);
  const [isDownloadingSegments, setIsDownloadingSegments] = useState(false);
  const wsRef = useRef(null);

  const normalizeSegments = (segmentList = []) =>
    segmentList
      .filter((segment) => segment?.url)
      .map((segment) => ({
        ...segment,
        imageUrl: `${API_BASE_URL}${segment.url}`,
      }));

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
        if (data.segments) {
          setSegments(normalizeSegments(data.segments));
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
      setSegments([]);
      setIsProcessing(false);
      setIsDownloadingSegments(false);
      
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
        if (response.data.segments) {
          setSegments(normalizeSegments(response.data.segments));
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
    setSegments([]);
    setIsProcessing(false);
    setIsDownloadingSegments(false);
    setResultId(null);
  };

  const handleDownloadSegments = async () => {
    if (!resultId || segments.length === 0 || isDownloadingSegments) {
      return;
    }
    try {
      setIsDownloadingSegments(true);
      const response = await fetch(`${API_BASE_URL}/api/results/${resultId}/segments.zip`);
      if (!response.ok) {
        throw new Error('Failed to download segments');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roof-segments-${resultId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Segments download error:', error);
      alert('Failed to download segments. Please try again.');
    } finally {
      setIsDownloadingSegments(false);
    }
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

              {segments.length > 0 && (
                <div className="segments-section">
                  <div className="segments-header">
                    <h3>Detected Segments</h3>
                    <div className="segments-actions">
                      <span>{segments.length} found</span>
                      <button
                        className="segments-download-button"
                        onClick={handleDownloadSegments}
                        disabled={isDownloadingSegments}
                      >
                        {isDownloadingSegments ? 'Preparing Zip...' : '⬇️ Download Segments'}
                      </button>
                    </div>
                  </div>
                  <div className="segments-grid">
                    {segments.map((segment) => (
                      <div className="segment-card" key={segment.id}>
                        <div className="segment-image-wrapper">
                          {segment.imageUrl ? (
                            <img
                              src={segment.imageUrl}
                              alt={segment.className || 'Detected segment'}
                            />
                          ) : (
                            <div className="segment-placeholder">No preview</div>
                          )}
                        </div>
                        <div className="segment-meta">
                          <div>
                            <strong>{segment.className || 'Segment'}</strong>
                            {segment.confidence !== undefined && segment.confidence !== null && (
                              <span className="segment-confidence">
                                {(segment.confidence * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          {segment.bbox && (
                            <span className="segment-bbox">
                              BBox: {segment.bbox.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;


