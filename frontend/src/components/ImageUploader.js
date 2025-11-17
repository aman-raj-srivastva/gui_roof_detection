import React, { useRef } from 'react';
import './ImageUploader.css';

const ImageUploader = ({ onImageUpload, disabled }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      onImageUpload(file);
    } else {
      alert('Please select a valid image file');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className={`upload-area ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <div className="upload-content">
        <div className="upload-icon">📤</div>
        <h3>Drop your image here or click to browse</h3>
        <p>Supports: JPG, PNG, GIF, BMP, WEBP</p>
        {disabled && <p className="disabled-message">Processing in progress...</p>}
      </div>
    </div>
  );
};

export default ImageUploader;



