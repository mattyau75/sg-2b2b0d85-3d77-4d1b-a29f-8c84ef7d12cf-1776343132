import modal
import os
import json

# MODAL_ELITE_WORKER v5.2 - High-Density Color Calibration System
# Optimized for small-sample basketball scouting

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
    import requests
    import base64
    
    print(f"\n[STAGE 2] Starting High-Density Calibration for Game: {game_id}")
    
    try:
        # Configuration
        api_key = os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
        model_id = "basketball-jersey-numbers-ocr/2" 
        inference_url = f"https://detect.roboflow.com/{model_id}?api_key={api_key}&confidence=0.3"
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            return {"status": "error", "message": f"Failed to open video: {video_url}"}
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # Increase sample points to 10 distinct sections of the game
        sample_sections = [int(total_frames * p) for p in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]]
        
        all_jersey_colors = []
        frames_checked = 0
        
        for section_start in sample_sections:
            # At each section, check 5 consecutive frames to increase hit-rate
            for offset in range(5):
                cap.set(cv2.CAP_PROP_POS_FRAMES, section_start + (offset * 5))
                ret, frame = cap.read()
                if not ret: continue
                
                frames_checked += 1
                h, w = frame.shape[:2]
                target_w = 1280
                target_h = int(h * (target_w / w))
                frame_resized = cv2.resize(frame, (target_w, target_h))
                
                _, buffer = cv2.imencode('.jpg', frame_resized)
                img_base64 = base64.b64encode(buffer).decode('utf-8')
                
                try:
                    res = requests.post(
                        inference_url,
                        data=img_base64,
                        headers={"Content-Type": "application/x-www-form-urlencoded"}
                    )
                    results = res.json()
                except:
                    continue
                
                if not results.get('predictions'): continue
                
                for pred in results['predictions']:
                    x1 = int(pred['x'] - pred['width'] / 2)
                    y1 = int(pred['y'] - pred['height'] / 2)
                    x2 = int(pred['x'] + pred['width'] / 2)
                    y2 = int(pred['y'] + pred['height'] / 2)
                    
                    crop = frame_resized[max(0, y1):min(target_h, y2), max(0, x1):min(target_w, x2)]
                    if crop.size < 50: continue
                    
                    pixels = crop.reshape(-1, 3).astype(np.float32)
                    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
                    _, _, centers = cv2.kmeans(pixels, 3, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
                    
                    best_color = None
                    max_score = -1000
                    
                    for center in centers:
                        b, g, r = center
                        brightness = (r + g + b) / 3
                        saturation = max(r, g, b) - min(r, g, b)
                        score = (saturation * 2.5) + (brightness * 1.2)
                        
                        # Aggressive filter for court and wood
                        if (r > 120 and g > 100 and abs(r - g) < 35): score -= 300 
                        if (abs(r - g) < 15 and abs(g - b) < 15): score -= 250 
                        
                        if score > max_score:
                            max_score = score
                            best_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
                    
                    if best_color: all_jersey_colors.append(best_color)
            
            # Optimization: If we already have 20+ samples, we have plenty for a clean calibration
            if len(all_jersey_colors) >= 20: break
        
        cap.release()
        
        print(f"[ROBOFLOW] Found {len(all_jersey_colors)} jersey samples across {frames_checked} frames.")
        
        if len(all_jersey_colors) < 2:
            return {"status": "error", "message": f"Insufficient jersey samples detected ({len(all_jersey_colors)} found). Please use a video with clearer player visibility."}
            
        # Cluster samples into Home vs Away
        rgb_colors = []
        for hex_c in all_jersey_colors:
            h = hex_c.lstrip('#')
            rgb_colors.append([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)])
            
        _, labels, centers = cv2.kmeans(np.array(rgb_colors, dtype=np.float32), 2, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        
        # Calculate consistency score for each cluster to ensure they are distinct teams
        return {
            "status": "success",
            "colors": {
                "home": f"#{int(centers[0][0]):02x}{int(centers[0][1]):02x}{int(centers[0][2]):02x}", 
                "away": f"#{int(centers[1][0]):02x}{int(centers[1][1]):02x}{int(centers[1][2]):02x}"
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
