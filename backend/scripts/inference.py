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
        
        segments_info = []

        if result.masks is not None and result.boxes is not None:
            masks = result.masks.data.cpu().numpy()
            boxes = result.boxes.xyxy.cpu().numpy()
            class_ids = result.boxes.cls.cpu().numpy().astype(int)
            confidences = result.boxes.conf.cpu().numpy()
            class_names = getattr(model, 'names', {})

            output_path_obj = Path(output_path)
            segments_dir = output_path_obj.parent / f"{output_path_obj.stem}_segments"
            segments_dir.mkdir(parents=True, exist_ok=True)

            for idx, mask in enumerate(masks):
                mask_uint8 = (mask * 255).astype(np.uint8)

                masked_image = cv2.bitwise_and(img, img, mask=mask_uint8)

                x1, y1, x2, y2 = boxes[idx].astype(int)
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(img.shape[1], x2)
                y2 = min(img.shape[0], y2)

                if x2 <= x1 or y2 <= y1:
                    continue

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


