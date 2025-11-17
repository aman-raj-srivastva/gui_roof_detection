import React, { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import './ImageViewer.css';

const ImageViewer = ({ imageUrl }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDoubleClick = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  const [zoomFunctions, setZoomFunctions] = useState({ zoomIn: null, zoomOut: null });

  return (
    <>
      <div className="image-viewer-container">
        {isLoading && (
          <div className="image-loading">
            <div className="spinner"></div>
            <p>Loading image...</p>
          </div>
        )}
        <TransformWrapper
          initialScale={1}
          initialPositionX={0}
          initialPositionY={0}
          minScale={0.5}
          maxScale={4}
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: true }}
          pan={{ disabled: false, lockAxisX: false, lockAxisY: false }}
          zoom={{ disabled: false }}
          limitToBounds={false}
          centerOnInit={true}
          centerZoomedOut={false}
        >
          {({ zoomIn, zoomOut, resetTransform }) => {
            if (!zoomFunctions.zoomIn) {
              setZoomFunctions({ zoomIn, zoomOut });
            }
            return (
              <TransformComponent>
                <img
                  src={imageUrl}
                  alt="Display"
                  className="viewer-image"
                  onLoad={() => setIsLoading(false)}
                  onDoubleClick={handleDoubleClick}
                  style={{ display: isLoading ? 'none' : 'block' }}
                />
              </TransformComponent>
            );
          }}
        </TransformWrapper>
        <div className="image-controls">
          <button onClick={() => zoomFunctions.zoomIn?.()} className="control-btn" title="Zoom In">
            🔍+
          </button>
          <button onClick={() => zoomFunctions.zoomOut?.()} className="control-btn" title="Zoom Out">
            🔍-
          </button>
          <button onClick={handleDoubleClick} className="control-btn" title="Fullscreen">
            ⛶ Fullscreen
          </button>
        </div>
      </div>

      {isFullscreen && (
        <div className="fullscreen-overlay" onClick={closeFullscreen}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-fullscreen" onClick={closeFullscreen}>✕</button>
            <img
              src={imageUrl}
              alt="Fullscreen"
              className="fullscreen-image"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ImageViewer;


