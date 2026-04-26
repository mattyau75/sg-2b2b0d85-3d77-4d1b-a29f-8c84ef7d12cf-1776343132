import modal
import os

# MODAL_ELITE_WORKER v5.5 - Direct Fast-Exit Scouting
# Optimized for speed and direct response without DB handshaking

app = modal.App("basketball-scout-ai")
stub = app

image = modal.Image.debian_slim().apt_install(
    "libgl1-mesa-glx",
    "libglib2.0-0"
).pip_install(
    "fastapi[standard]",
    "requests",
    "opencv-python-headless",
    "numpy"
)

def detect_colors_direct(video_url: str, game_id: str):
    import cv2
    import numpy as np
    import requests
    import base64
    import time
    
    print(f"[AI] Direct Color Calibration: {game_id}")
    start_time = time.time()
    
    try:
        api_key = os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
        model_id = "basketball-jersey-numbers-ocr/2" 
        inference_url = f"https://detect.roboflow.com/{model_id}?api_key={api_key}"
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            return {"status": "error", "message": "Video source unreachable"}
        
        # Target the first 90 seconds with a High-Density Sweep
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        # Check every 6 seconds for better coverage
        sample_points = [int(fps * s) for s in range(5, 95, 6)]
        
        all_jersey_colors = []
        
        for frame_idx in sample_points:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret: continue
            
            # High-res processing for small jersey detection
            h, w = frame.shape[:2]
            target_w = 1280
            target_h = int(h * (target_w / w))
            frame_resized = cv2.resize(frame, (target_w, target_h))
            
            _, buffer = cv2.imencode('.jpg', frame_resized)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            try:
                # Use a slightly lower threshold for better recall in panning footage
                res = requests.post(
                    f"{inference_url}&confidence=30", 
                    data=img_base64,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=4
                )
                preds = res.json().get('predictions', [])
                
                for pred in preds:
                    # Target center of jersey to avoid skin/floor
                    x, y, pw, ph = pred['x'], pred['y'], pred['width'], pred['height']
                    x1, y1 = int(x - pw/5), int(y - ph/5)
                    x2, y2 = int(x + pw/5), int(y + ph/5)
                    
                    crop = frame_resized[max(0, y1):min(target_h, y2), max(0, x1):min(target_w, x2)]
                    if crop.size < 15: continue
                    
                    # Extract dominant color with court filtering
                    pixels = crop.reshape(-1, 3).astype(np.float32)
                    _, _, centers = cv2.kmeans(pixels, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 5, 1.0), 5, cv2.KMEANS_PP_CENTERS)
                    
                    for center in centers:
                        b, g, r = center
                        saturation = max(r, g, b) - min(r, g, b)
                        # More inclusive filter: Reject court tan but accept vibrant jerseys
                        is_court = (r > 130 and g > 100 and abs(r-g) < 45 and saturation < 65)
                        if not is_court:
                            all_jersey_colors.append([r, g, b])
            except:
                continue
            
            # Early exit if we have a solid dataset
            if len(all_jersey_colors) >= 12:
                break
                
        cap.release()
        
        if len(all_jersey_colors) < 2:
            return {"status": "error", "message": "No clear jerseys found in initial footage"}
            
        # Final Cluster into 2 teams
        _, _, final_centers = cv2.kmeans(np.array(all_jersey_colors, dtype=np.float32), 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 10, cv2.KMEANS_PP_CENTERS)
        
        # Sort by brightness
        sorted_centers = sorted(final_centers.tolist(), key=lambda c: sum(c), reverse=True)
        
        elapsed = time.time() - start_time
        print(f"[AI] Done in {elapsed:.2f}s with {len(all_jersey_colors)} samples")
        
        return {
            "status": "success",
            "colors": {
                "home": f"#{int(sorted_centers[0][0]):02x}{int(sorted_centers[0][1]):02x}{int(sorted_centers[0][2]):02x}", 
                "away": f"#{int(sorted_centers[1][0]):02x}{int(sorted_centers[1][1]):02x}{int(sorted_centers[1][2]):02x}"
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.function(image=image, gpu="A10G", timeout=600)
@modal.asgi_app()
def analyze():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    web_app = FastAPI()
    
    @web_app.post("/")
    async def analyze_endpoint(request: Request):
        data = await request.json()
        if data.get("pipeline_mode") == "ping":
            return JSONResponse(content={"status": "warm"})
        
        result = detect_colors_direct(data.get("video_url"), data.get("game_id"))
        return JSONResponse(content=result)
    
    return web_app
