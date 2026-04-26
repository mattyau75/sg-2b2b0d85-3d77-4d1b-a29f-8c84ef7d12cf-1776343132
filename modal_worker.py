import modal
import os
import json
import cv2
import numpy as np
import requests
import base64
import time
from concurrent.futures import ThreadPoolExecutor
from ultralytics import YOLO

# MODAL_ELITE_WORKER v5.3 - Hybrid Scouting System
# Optimized for panning shots and small-sample personnel detection

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
    "yolo export model=yolo11n.pt format=onnx"
)

app = modal.App("basketball-scout-ai")

def detect_colors_yolo11m(video_url: str, game_id: str):
    start_time = time.time()
    print(f"\n[STAGE 2] Starting Hybrid Color Calibration for Game: {game_id}")
    
    try:
        # Load Local YOLO for fallback (Person detection)
        # Using nano version for extreme speed in the processing loop
        local_model = YOLO("yolo11n.pt")
        
        # Configuration for specialized Roboflow Jersey Model
        api_key = os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
        model_id = "basketball-jersey-numbers-ocr/2" 
        inference_url = f"https://detect.roboflow.com/{model_id}?api_key={api_key}&confidence=25" # Lowered confidence for blurry pans
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            return {"status": "error", "message": f"Failed to open video: {video_url}"}
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # 5 strategic sections, 5 frames each = 25 total samples
        sample_sections = [int(total_frames * p) for p in [0.15, 0.35, 0.55, 0.75, 0.9]]
        
        captured_frames = []
        for section_start in sample_sections:
            for offset in range(5):
                cap.set(cv2.CAP_PROP_POS_FRAMES, section_start + (offset * 15))
                ret, frame = cap.read()
                if not ret: continue
                captured_frames.append(frame)
        cap.release()

        def extract_dominant_color(crop):
            if crop.size < 50: return None
            pixels = crop.reshape(-1, 3).astype(np.float32)
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
            _, _, centers = cv2.kmeans(pixels, 3, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
            
            best_color = None
            max_score = -1000
            for center in centers:
                b, g, r = center
                brightness = (r + g + b) / 3
                saturation = max(r, g, b) - min(r, g, b)
                
                # ADVANCED SCORING (Matches specialized color-classify models)
                # Boost colors with higher saturation (team primary colors)
                score = (saturation * 4.0) + (brightness * 0.5)
                
                # HEAVY PENALTIES for non-jersey artifacts
                # 1. Penalty for Court/Skin tones (Warm orange/tan)
                if (r > 140 and g > 110 and abs(r - g) < 45): score -= 500
                # 2. Penalty for pure neutrals (Grey/Black floor shadows)
                if (abs(r - g) < 12 and abs(g - b) < 12): score -= 400
                
                if score > max_score:
                    max_score = score
                    best_color = [r, g, b]
            return best_color

        def process_frame(frame):
            h, w = frame.shape[:2]
            target_w = 1280
            target_h = int(h * (target_w / w))
            frame_resized = cv2.resize(frame, (target_w, target_h))
            
            frame_colors = []
            
            # --- ATTEMPT 1: Specialized Roboflow Jersey Model ---
            _, buffer = cv2.imencode('.jpg', frame_resized)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            try:
                res = requests.post(
                    inference_url,
                    data=img_base64,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=4
                )
                roboflow_results = res.json()
                
                if roboflow_results.get('predictions'):
                    for pred in roboflow_results['predictions']:
                        x1 = int(pred['x'] - pred['width'] / 2)
                        y1 = int(pred['y'] - pred['height'] / 2)
                        x2 = int(pred['x'] + pred['width'] / 2)
                        y2 = int(pred['y'] + pred['height'] / 2)
                        
                        crop = frame_resized[max(0, y1):min(target_h, y2), max(0, x1):min(target_w, x2)]
                        color = extract_dominant_color(crop)
                        if color: frame_colors.append(color)
            except:
                pass # Fallback to YOLO if Roboflow fails/times out

            # --- ATTEMPT 2: Fallback to Local YOLO Person Detection ---
            # If we didn't find enough colors from jerseys, find people and sample torsos
            if len(frame_colors) < 2:
                yolo_results = local_model(frame_resized, classes=[0], conf=0.4, verbose=False) # class 0 = person
                for r in yolo_results:
                    for box in r.boxes:
                        bx1, by1, bx2, by2 = box.xyxy[0].cpu().numpy()
                        ph = by2 - by1
                        
                        # Sample from the "Torso Zone" (Upper 20% to 50% of the body)
                        ty1 = int(by1 + (ph * 0.2))
                        ty2 = int(by1 + (ph * 0.5))
                        
                        crop = frame_resized[max(0, ty1):min(target_h, ty2), max(0, int(bx1)):min(target_w, int(bx2))]
                        color = extract_dominant_color(crop)
                        if color: frame_colors.append(color)
            
            return frame_colors

        # Run processing
        all_jersey_colors = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(process_frame, captured_frames))
            for frame_colors in results:
                all_jersey_colors.extend(frame_colors)
        
        print(f"[HYBRID] Total samples collected: {len(all_jersey_colors)}")
        
        if len(all_jersey_colors) < 2:
            return {"status": "error", "message": "The AI scouting engine could not find enough players in this footage. Please check if the video has clear view of the court."}
            
        # Cluster into 2 teams
        _, labels, centers = cv2.kmeans(np.array(all_jersey_colors, dtype=np.float32), 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 10, cv2.KMEANS_PP_CENTERS)
        
        # Sort by brightness so 'Home' is usually the lighter color (common convention)
        center_list = sorted(centers.tolist(), key=lambda c: sum(c), reverse=True)
        
        elapsed = time.time() - start_time
        print(f"[HYBRID] Calibration complete in {elapsed:.2f}s")
        
        return {
            "status": "success",
            "colors": {
                "home": f"#{int(center_list[0][2]):02x}{int(center_list[0][1]):02x}{int(center_list[0][0]):02x}", 
                "away": f"#{int(center_list[1][2]):02x}{int(center_list[1][1]):02x}{int(center_list[1][0]):02x}"
            },
            "game_id": game_id
        }
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return {"status": "error", "message": f"AI Calibration failed: {str(e)}"}

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
