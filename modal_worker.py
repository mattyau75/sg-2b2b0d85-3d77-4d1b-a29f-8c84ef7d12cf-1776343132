import modal
import os
import time
import traceback

# MODAL_ELITE_PIPELINE v8.8 - High-Performance Caching & Elite Scouting
# This volume provides persistent SSD storage on the GPU for 24h video caching
volume = modal.Volume.from_name("scout-video-cache", create_if_missing=True)

app = modal.App("basketball-scout-ai")

# Secrets are expected to be in the "basketball-scout-secrets" vault in Modal
app_secrets = [
    modal.Secret.from_name("basketball-scout-secrets")
]

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0", "ffmpeg", "libsm6", "libxext6", "wget")
    .pip_install(
        "ultralytics",
        "opencv-python-headless",
        "supabase",
        "numpy",
        "scikit-learn",
        "fastapi",
        "uvicorn",
        "requests"
    )
)

def download_to_cache(url: str, cache_path: str):
    """Download video from R2 to the persistent Modal Volume if it doesn't exist"""
    import requests # Imported inside function to avoid deployment errors
    
    if os.path.exists(cache_path):
        print(f"⚡ GPU Cache Hit: {cache_path}")
        return True
    
    print(f"📥 GPU Cache Miss. Downloading from R2: {url}")
    try:
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        
        with open(cache_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=1024*1024): # 1MB chunks
                if chunk:
                    f.write(chunk)
        
        # Commit to volume
        volume.commit()
        print(f"✅ Video cached successfully: {cache_path}")
        return True
    except Exception as e:
        print(f"❌ Cache download failed: {str(e)}")
        return False

# ============================================================================
# ADVANCED COLOR DETECTION ENGINE v2.0
# ============================================================================
class AdvancedJerseyColorDetector:
    def __init__(self, yolo_model_path='yolo11m.pt'):
        from ultralytics import YOLO
        self.model = YOLO(yolo_model_path)
        
    def detect_motion_blur(self, frame):
        import cv2 # Imported inside to avoid deployment errors
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var()

    def preprocess_for_indoor_lighting(self, image):
        import cv2
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    def is_excluded(self, hsv_pixel):
        h, s, v = hsv_pixel[0]/2, hsv_pixel[1]/255, hsv_pixel[2]/255
        if 0 <= h <= 12.5 and s > 0.2 and v > 0.3: return True # Skin
        if 5 <= h <= 20 and s < 0.4 and 0.2 < v < 0.6: return True # Floor
        if v < 0.15: return True # Dark
        return False

    def extract_jersey_colors(self, crop):
        import cv2
        import numpy as np
        from sklearn.cluster import KMeans
        crop = cv2.resize(crop, (40, 40))
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        pixels = hsv.reshape(-1, 3)
        valid_pixels = [p for p in pixels if not self.is_excluded(p)]
        
        if len(valid_pixels) < 50: return None
        
        kmeans = KMeans(n_clusters=2, n_init=3)
        kmeans.fit(np.array(valid_pixels))
        centers = kmeans.cluster_centers_
        return [cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_HSV2BGR)[0][0] for c in centers]

# ============================================================================
# STAGE 2: JERSEY CALIBRATION (ELITE v8.8)
# ============================================================================
def stage2_calibration(video_source: str, game_id: str):
    import cv2
    import numpy as np
    from supabase import create_client
    from sklearn.cluster import KMeans
    
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase = create_client(supabase_url, supabase_key)
    
    try:
        detector = AdvancedJerseyColorDetector()
        cap = cv2.VideoCapture(video_source)
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        collected_samples = []
        unique_players_found = 0
        frame_idx = 0
        max_scan_frames = int(fps * 600) 
        skip_interval = int(fps * 3)    
        
        while frame_idx < max_scan_frames:
            ret, frame = cap.read()
            if not ret: break
            if frame_idx % skip_interval != 0:
                frame_idx += 1
                continue
            
            if detector.detect_motion_blur(frame) < 12.0:
                frame_idx += 1
                continue
            
            enhanced = detector.preprocess_for_indoor_lighting(frame)
            results = detector.model(enhanced, classes=[0], conf=0.30, verbose=False)
            
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    h_total = y2 - y1
                    jersey_crop = enhanced[max(0, y1 + int(h_total * 0.15)):min(frame.shape[0], y1 + int(h_total * 0.55)), max(0, x1):min(frame.shape[1], x2)]
                    if jersey_crop.size > 0:
                        colors = detector.extract_jersey_colors(jersey_crop)
                        if colors: collected_samples.extend(colors)
                        unique_players_found += 1
            
            if unique_players_found >= 10 and len(collected_samples) >= 120: break
            frame_idx += 1
            
        cap.release()
        
        if len(collected_samples) < 10: raise Exception("Insufficient samples")
            
        kmeans = KMeans(n_clusters=2, n_init=10)
        kmeans.fit(np.array(collected_samples))
        sorted_colors = sorted(kmeans.cluster_centers_.tolist(), key=lambda c: sum(c), reverse=True)
        
        home_hex = f"#{int(sorted_colors[0][2]):02x}{int(sorted_colors[0][1]):02x}{int(sorted_colors[0][0]):02x}"
        away_hex = f"#{int(sorted_colors[1][2]):02x}{int(sorted_colors[1][1]):02x}{int(sorted_colors[1][0]):02x}"
        
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "metadata": {"colors": {"home": home_hex, "away": away_hex}, "pipeline_version": "8.8"},
            "status": "calibration_complete"
        }).execute()
        
        return {"status": "success", "colors": {"home": home_hex, "away": away_hex}}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.function(
    image=image,
    gpu="A10G",
    timeout=3600,
    volumes={"/cache": volume},
    secrets=app_secrets
)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    web_app = FastAPI()
    
    @web_app.post("/")
    async def handle_request(request: Request):
        try:
            body = await request.json()
            game_id = body.get("game_id")
            video_url = body.get("video_url")
            mode = body.get("pipeline_mode")
            
            if mode == "ping": return JSONResponse(content={"status": "warm"})
            if not game_id or not video_url: return JSONResponse({"error": "Missing params"}, 400)
            
            # Caching Step: Video persists in Volume for 24h
            cache_path = f"/cache/{game_id}.mp4"
            if not download_to_cache(video_url, cache_path):
                # Fallback to direct URL if download fails
                video_source = video_url
            else:
                video_source = cache_path
            
            if mode in ["stage2_calibration", "color_calibration"]:
                return JSONResponse(content=stage2_calibration(video_source, game_id))
                
            return JSONResponse(content={"status": "error", "message": "Invalid mode"}, status_code=400)
        except Exception as e:
            return JSONResponse({"status": "error", "message": str(e)}, 500)
            
    return web_app
