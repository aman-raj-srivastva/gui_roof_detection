import React from 'react';
import './ProgressBar.css';

const ProgressBar = ({ progress, label, className = '' }) => {
  return (
    <div className={`progress-container ${className}`}>
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-percentage">{Math.round(progress)}%</span>
      </div>
      <div className="progress-bar-wrapper">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progress}%` }}
        >
          <div className="progress-bar-shine"></div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;






