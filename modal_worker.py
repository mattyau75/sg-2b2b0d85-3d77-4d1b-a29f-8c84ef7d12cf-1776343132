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
    from concurrent.futures import ThreadPoolExecutor
    
    print(f"\n[STAGE 2] Starting Optimized Parallel Calibration for Game: {game_id}")
    
    try:
        # Configuration
        api_key = os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
        model_id = "basketball-jersey-numbers-ocr/2" 
        inference_url = f"https://detect.roboflow.com/{model_id}?api_key={api_key}"
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            return {"status": "error", "message": f"Failed to open video: {video_url}"}
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sample_sections = [int(total_frames * p) for p in [0.2, 0.4, 0.6, 0.8, 0.9]]
        
        captured_frames = []
        for section_start in sample_sections:
            for offset in range(3): # 3 frames per section = 15 total frames
                cap.set(cv2.CAP_PROP_POS_FRAMES, section_start + (offset * 10))
                ret, frame = cap.read()
                if not ret: continue
                captured_frames.append(frame)
        cap.release()

        def process_frame(frame):
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
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=5
                )
                results = res.json()
                
                colors = []
                if results.get('predictions'):
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
                            if (r > 120 and g > 100 and abs(r - g) < 35): score -= 300 
                            if (abs(r - g) < 15 and abs(g - b) < 15): score -= 250 
                            
                            if score > max_score:
                                max_score = score
                                best_color = [r, g, b]
                        if best_color: colors.append(best_color)
                return colors
            except:
                return []

        # Run Roboflow calls in parallel (max 5 threads to avoid rate limits)
        all_jersey_colors = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(process_frame, captured_frames))
            for frame_colors in results:
                all_jersey_colors.extend(frame_colors)
        
        print(f"[ROBOFLOW] Found {len(all_jersey_colors)} jersey samples.")
        
        if len(all_jersey_colors) < 2:
            return {"status": "error", "message": "Insufficient jersey samples detected. Try a video with clearer player visibility."}
            
        _, labels, centers = cv2.kmeans(np.array(all_jersey_colors, dtype=np.float32), 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 10, cv2.KMEANS_PP_CENTERS)
        
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
