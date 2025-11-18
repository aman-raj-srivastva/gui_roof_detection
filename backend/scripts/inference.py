import sys
import json
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

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
        
        # Get original image dimensions
        orig_height, orig_width = img.shape[0], img.shape[1]
        
        # Validate image dimensions
        if orig_height == 0 or orig_width == 0:
            raise ValueError(f"Invalid image dimensions: {orig_width}x{orig_height}")
        
        send_progress(50, f"Running inference on {orig_width}x{orig_height} image...")
        
        # Run inference - YOLO will automatically handle resizing
        # Don't specify imgsz to let YOLO use model's default or auto-detect
        # This ensures compatibility with any model input size
        try:
            results = model(image_path)
        except Exception as e:
            # If inference fails, try with explicit size
            send_progress(50, "Retrying with standard size...")
            results = model(image_path, imgsz=640)
        
        send_progress(80, "Processing results...")
        
        # Get the first result
        result = results[0]
        
        # Create output image with segmentation overlay
        annotated_img = result.plot()
        
        # Save the result
        cv2.imwrite(output_path, annotated_img)
        
        segments_info = []

        if result.masks is not None and result.boxes is not None:
            # Get masks and boxes - these are already in original image coordinates
            masks = result.masks.data.cpu().numpy()
            boxes = result.boxes.xyxy.cpu().numpy()
            class_ids = result.boxes.cls.cpu().numpy().astype(int)
            confidences = result.boxes.conf.cpu().numpy()
            class_names = getattr(model, 'names', {})

            # Get the shape of the masks (model input size)
            # Masks are returned in the model's input resolution, need to scale to original
            mask_height, mask_width = masks.shape[1], masks.shape[2]
            
            # Calculate scaling factors
            scale_x = orig_width / mask_width
            scale_y = orig_height / mask_height

            output_path_obj = Path(output_path)
            segments_dir = output_path_obj.parent / f"{output_path_obj.stem}_segments"
            segments_dir.mkdir(parents=True, exist_ok=True)

            for idx, mask in enumerate(masks):
                # Ensure mask is 2D
                if len(mask.shape) > 2:
                    mask = mask.squeeze()
                
                # Scale mask to original image size
                # cv2.resize expects (width, height) for size parameter
                mask_resized = cv2.resize(mask, (orig_width, orig_height), interpolation=cv2.INTER_LINEAR)
                
                # Normalize and binarize mask
                if mask_resized.max() <= 1.0:
                    mask_binary = (mask_resized > 0.5).astype(np.uint8) * 255
                else:
                    mask_binary = (mask_resized > 127).astype(np.uint8) * 255

                # Ensure mask is the same size as image
                if mask_binary.shape[:2] != (orig_height, orig_width):
                    mask_binary = cv2.resize(mask_binary, (orig_width, orig_height), interpolation=cv2.INTER_NEAREST)

                # Apply the scaled mask to the original image
                masked_image = cv2.bitwise_and(img, img, mask=mask_binary)

                # Get bounding box (already in original coordinates from YOLO)
                x1, y1, x2, y2 = boxes[idx].astype(int)
                
                # Ensure coordinates are within image bounds
                x1 = max(0, min(x1, orig_width - 1))
                y1 = max(0, min(y1, orig_height - 1))
                x2 = max(x1 + 1, min(x2, orig_width))
                y2 = max(y1 + 1, min(y2, orig_height))

                if x2 <= x1 or y2 <= y1:
                    continue

                # Crop the segment using bounding box
                cropped_segment = masked_image[y1:y2, x1:x2]
                if cropped_segment.size == 0:
                    continue

                segment_filename = f"{output_path_obj.stem}_segment_{idx + 1}.png"
                segment_path = segments_dir / segment_filename

                cv2.imwrite(str(segment_path), cropped_segment)

                relative_path = segment_path.relative_to(output_path_obj.parent).as_posix()

                if isinstance(class_names, dict):
                    class_name = class_names.get(int(class_ids[idx]), str(class_ids[idx]))
                elif isinstance(class_names, (list, tuple)) and 0 <= int(class_ids[idx]) < len(class_names):
                    class_name = class_names[int(class_ids[idx])]
                else:
                    class_name = str(class_ids[idx])

                segments_info.append({
                    "relative_path": relative_path,
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "class_id": int(class_ids[idx]) if len(class_ids) > idx else None,
                    "class_name": class_name,
                    "confidence": float(confidences[idx]) if len(confidences) > idx else None
                })
        
        send_progress(90, "Saving outputs...")
        
        send_progress(100, "Complete!")
        
        # Print success message
        print(json.dumps({
            "type": "success",
            "message": "Inference completed",
            "output_path": output_path,
            "segments": segments_info
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


