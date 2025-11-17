import sys
import json
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import torch

def send_progress(progress, message):
    """Send progress update to Node.js"""
    print(json.dumps({"type": "progress", "progress": progress, "message": message}))
    sys.stdout.flush()

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"type": "error", "message": "Usage: python inference.py <model_path> <image_path> <output_path>"}))
        sys.exit(1)
    
    model_path = sys.argv[1]
    image_path = sys.argv[2]
    output_path = sys.argv[3]
    
    try:
        send_progress(10, "Loading model...")
        
        # Load the YOLOv11 model
        model = YOLO(model_path)
        
        send_progress(30, "Reading image...")
        
        # Read the input image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not read image from {image_path}")
        
        send_progress(50, "Running inference...")
        
        # Run inference
        results = model(image_path)
        
        send_progress(80, "Processing results...")
        
        # Get the first result
        result = results[0]
        
        # Create output image with segmentation overlay
        annotated_img = result.plot()
        
        # Save the result
        cv2.imwrite(output_path, annotated_img)
        
        send_progress(100, "Complete!")
        
        # Print success message
        print(json.dumps({
            "type": "success",
            "message": "Inference completed",
            "output_path": output_path
        }))
        
    except Exception as e:
        error_msg = str(e)
        print(json.dumps({
            "type": "error",
            "message": f"Inference failed: {error_msg}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()


