import modal
import os
import json

# MODAL_ELITE_WORKER v5.0 - Multi-Model Basketball Analysis System
# Optimized for high-accuracy Stage 2 Color Calibration using Roboflow Universe

image = modal.Image.debian_slim().apt_install(
    "libgl1-mesa-glx",
    "libglib2.0-0",
    "libsm6",
    "libxext6",
    "libxrender-dev",
    "libgomp1"
).pip_install(
    "fastapi[standard]",
    "requests",
    "opencv-python-headless",
    "numpy",
    "Pillow",
    "ultralytics>=8.0.0",
    "torch",
    "torchvision",
    "roboflow",
    "supervision"
).run_commands(
    "yolo export model=yolo11m.pt format=onnx"
)

app = modal.App("basketball-scout-ai")

def detect_colors_yolo11m(video_url: str, game_id: str):
    import cv2
    import numpy as np
    from ultralytics import YOLO
    from roboflow import Roboflow
    
    print(f"\n[STAGE 2] Starting Color Calibration for Game: {game_id}")
    
    try:
        # Load Roboflow with provided Private API Key
        api_key = os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
        rf = Roboflow(api_key=api_key)
        
        # Robust model loading for public Roboflow Universe projects
        # Standard Public Slug: roboflow-j7lti/basketball-jersey-numbers-ocr
        try:
            project = rf.workspace("roboflow-j7lti").project("basketball-jersey-numbers-ocr")
        except:
            # Fallback: List workspaces to find the project if slug changed or is private
            print("[ROBOFLOW] Public slug failed, searching workspaces...")
            workspaces = rf.workspaces()
            found = False
            for ws in workspaces:
                try:
                    project = rf.workspace(ws).project("basketball-jersey-numbers-ocr")
                    found = True
                    break
                except: continue
            if not found:
                raise Exception("Could not find project 'basketball-jersey-numbers-ocr' in any accessible workspace.")
                
        roboflow_model = project.version(2).model
        print("[ROBOFLOW] ✓ Specialized Jersey OCR Model Active")
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            return {"status": "error", "message": f"Failed to open video: {video_url}"}
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sample_positions = [int(total_frames * p) for p in [0.2, 0.4, 0.6, 0.8]]
        
        all_jersey_colors = []
        
        for frame_idx in sample_positions:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret: continue
            
            # High-res processing (1280px) for small player detection
            h, w = frame.shape[:2]
            target_w = 1280
            scale = target_w / w
            frame_resized = cv2.resize(frame, (target_w, int(h * scale)))
            
            # Predict using Roboflow
            temp_path = f"/tmp/frame_{frame_idx}.jpg"
            cv2.imwrite(temp_path, frame_resized)
            results = roboflow_model.predict(temp_path, confidence=40).json()
            
            if not results.get('predictions'): continue
            
            for pred in results['predictions']:
                x1 = int(pred['x'] - pred['width'] / 2)
                y1 = int(pred['y'] - pred['height'] / 2)
                x2 = int(pred['x'] + pred['width'] / 2)
                y2 = int(pred['y'] + pred['height'] / 2)
                
                # Crop focusing on the jersey fabric
                crop = frame_resized[max(0, y1):min(target_w, y2), max(0, x1):min(target_w, x2)]
                if crop.size < 50: continue
                
                # K-means to isolate dominant color with Grey/Tan Exclusion
                pixels = crop.reshape(-1, 3).astype(np.float32)
                _, _, centers = cv2.kmeans(pixels, 3, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 10, cv2.KMEANS_PP_CENTERS)
                
                best_color = None
                max_score = -1000
                
                for center in centers:
                    b, g, r = center
                    brightness = (r + g + b) / 3
                    saturation = max(r, g, b) - min(r, g, b)
                    
                    # Score: Favor high vibrancy (Blue) or clean brightness (White)
                    score = (saturation * 2.0) + (brightness * 1.5)
                    
                    # Penalty for court-tan and shadow-grey
                    if (r > 100 and g > 80 and abs(r - g) < 25): score -= 200 # Court floor
                    if (abs(r - g) < 12 and abs(g - b) < 12): score -= 150 # Greyscale noise
                    
                    if score > max_score:
                        max_score = score
                        best_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
                
                if best_color: all_jersey_colors.append(best_color)
        
        cap.release()
        
        if len(all_jersey_colors) < 2:
            return {"status": "error", "message": "Insufficient jersey samples detected."}
            
        # Cluster samples into Home vs Away (2 teams)
        rgb_colors = []
        for hex_c in all_jersey_colors:
            h = hex_c.lstrip('#')
            rgb_colors.append([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)])
            
        _, _, centers = cv2.kmeans(np.array(rgb_colors, dtype=np.float32), 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 10, cv2.KMEANS_PP_CENTERS)
        
        return {
            "status": "success",
            "colors": {"home": f"#{int(centers[0][0]):02x}{int(centers[0][1]):02x}{int(centers[0][2]):02x}", "away": f"#{int(centers[1][0]):02x}{int(centers[1][1]):02x}{int(centers[1][2]):02x}"},
            "game_id": game_id
        }
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return {"status": "error", "message": f"Roboflow activation failed: {str(e)}. Check API key."}

@app.function(image=image, gpu="A10G", timeout=600)
@modal.asgi_app()
def analyze():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    web_app = FastAPI()
    
    @web_app.post("/")
    async def analyze_endpoint(request: Request):
        data = await request.json()
        if data.get("pipeline_mode") == "color_calibration":
            result = detect_colors_yolo11m(data.get("video_url"), data.get("game_id"))
            return JSONResponse(content=result)
        return JSONResponse(content={"status": "error", "message": "Invalid mode"}, status_code=400)
    
    return web_app
