import modal
import os
import traceback

# MODAL_ELITE_PIPELINE v8.8 - Standardized Naming Sync
app = modal.App("basketball-scout-ai")

# Capture deployment-time environment variables strictly
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
RB_KEY = os.environ.get("M_RB") or os.environ.get("ROBOFLOW_API_KEY") or ""

# Direct print for deployment-time debugging
print(f"--- MODAL VAULT CONNECTION ---")
print(f"Using Secret: basketball-scout-secrets")
print(f"-----------------------------")

app_secrets = [
    modal.Secret.from_name("basketball-scout-secrets")
]

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0", "ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "ultralytics",
        "opencv-python-headless",
        "supabase",
        "numpy",
        "scikit-learn",
        "fastapi",
        "uvicorn"
    )
)

# ============================================================================
# ADVANCED COLOR DETECTION ENGINE v2.0
# ============================================================================
class AdvancedJerseyColorDetector:
    def __init__(self, yolo_model_path='yolo11m.pt'):
        from ultralytics import YOLO
        import cv2
        import numpy as np
        from collections import deque
        
        self.model = YOLO(yolo_model_path)
        
        # CRITICAL: Optimized detection parameters for panning video
        self.conf_threshold = 0.35  # Lower for partial detections
        self.iou_threshold = 0.5
        
        # Motion compensation
        self.prev_frame = None
        self.motion_threshold = 15.0  # Threshold for Laplacian variance
        
        # Advanced color tracking
        self.team_colors = {0: deque(maxlen=60), 1: deque(maxlen=60)}
        self.stable_team_colors = {0: None, 1: None}
        self.color_update_frequency = 5
        self.frame_count = 0
        
        # Jersey-specific color filtering
        self.exclude_colors = self._define_exclude_colors()
        
    def _define_exclude_colors(self):
        """Define colors to exclude (skin, floor, ball)"""
        return {
            'skin': {'h_range': (0, 25), 's_min': 0.2, 'v_min': 0.3},
            'floor': {'h_range': (10, 40), 's_max': 0.4, 'v_range': (0.2, 0.6)},
            'dark': {'v_max': 0.15},
            'white': {'s_max': 0.15, 'v_min': 0.85}
        }
    
    def detect_motion_blur(self, frame):
        import cv2
        """Detect if frame has excessive motion blur via Laplacian variance"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var()

    def preprocess_for_indoor_lighting(self, image):
        import cv2
        """Enhance image for indoor basketball court lighting"""
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    def is_excluded(self, hsv_pixel):
        """Check if a color should be excluded (skin, floor, etc.)"""
        h, s, v = hsv_pixel[0]/2, hsv_pixel[1]/255, hsv_pixel[2]/255
        
        # Skin check
        if 0 <= h <= 12.5 and s > 0.2 and v > 0.3: return True
        # Floor check
        if 5 <= h <= 20 and s < 0.4 and 0.2 < v < 0.6: return True
        # Dark check
        if v < 0.15: return True
        
        return False

    def extract_jersey_colors(self, crop):
        import cv2
        import numpy as np
        from sklearn.cluster import KMeans
        
        # Resize for speed
        crop = cv2.resize(crop, (40, 40))
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        pixels = hsv.reshape(-1, 3)
        
        # Filter pixels using semantic exclusion
        valid_pixels = []
        for p in pixels:
            if not self.is_excluded(p):
                valid_pixels.append(p)
        
        if len(valid_pixels) < 50: return None
        
        kmeans = KMeans(n_clusters=2, n_init=3)
        kmeans.fit(np.array(valid_pixels))
        
        # Convert back to BGR
        centers = kmeans.cluster_centers_
        bgr_centers = [cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_HSV2BGR)[0][0] for c in centers]
        return bgr_centers

# ============================================================================
# STAGE 2: JERSEY CALIBRATION (ELITE v8.7)
# ============================================================================
def stage2_calibration(video_url: str, game_id: str):
    import cv2
    import numpy as np
    from supabase import create_client
    from sklearn.cluster import KMeans
    
    print(f"[STAGE 2] Calibrating colors for game {game_id}")
    print(f"[STAGE 2] Target URL: {video_url}")
    
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not all([supabase_url, supabase_key]): 
        return {"status": "error", "message": "Missing credentials"}
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        
        # Log start to UI
        supabase.table("game_events").insert({
            "game_id": game_id,
            "event_type": "gpu_trace",
            "severity": "info",
            "payload": {"message": f"GPU Worker v8.7: Initiating sequential scan of {video_url}"}
        }).execute()

        detector = AdvancedJerseyColorDetector()
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            print(f"[STAGE 2] ERROR: OpenCV could not open video stream.")
            raise Exception("Video source unreachable or format unsupported. Check R2 public access.")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        print(f"[STAGE 2] Stream Properties: {width}x{height} @ {fps} FPS")
        
        if fps <= 0: fps = 30
        
        collected_samples = []
        unique_players_found = 0
        frame_idx = 0
        max_scan_frames = int(fps * 600) # Scan up to 10 minutes
        skip_interval = int(fps * 3)    # Sample every 3 seconds
        
        print(f"[STAGE 2] Starting Sequential Scan (Sequential is more stable for streams)")
        
        while frame_idx < max_scan_frames:
            ret, frame = cap.read()
            if not ret:
                print(f"[STAGE 2] Stream ended or read error at frame {frame_idx}")
                break
                
            # Only process every Nth frame
            if frame_idx % skip_interval != 0:
                frame_idx += 1
                continue
            
            # 1. Motion Blur Check
            blur_score = detector.detect_motion_blur(frame)
            if blur_score < 12.0:
                frame_idx += 1
                continue
            
            # 2. Lighting Enhancement
            enhanced = detector.preprocess_for_indoor_lighting(frame)
            
            # 3. Detection
            results = detector.model(enhanced, classes=[0], conf=0.30, verbose=False)
            
            current_frame_players = 0
            for r in results:
                for box in r.boxes:
                    current_frame_players += 1
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    
                    # Extract jersey area (middle 40% of player)
                    h_total = y2 - y1
                    jersey_y1 = y1 + int(h_total * 0.15)
                    jersey_y2 = y1 + int(h_total * 0.55)
                    
                    if jersey_y2 <= jersey_y1: continue
                    
                    jersey_crop = enhanced[max(0, jersey_y1):min(frame.shape[0], jersey_y2), max(0, x1):min(frame.shape[1], x2)]
                    if jersey_crop.size == 0: continue
                    
                    colors = detector.extract_jersey_colors(jersey_crop)
                    if colors:
                        collected_samples.extend(colors)
            
            unique_players_found += current_frame_players
            if current_frame_players > 0:
                msg = f"Frame {frame_idx}: Detected {current_frame_players} players. Total color samples: {len(collected_samples)}"
                print(f"[STAGE 2] {msg}")
                # Stream progress to UI
                supabase.table("game_events").insert({
                    "game_id": game_id,
                    "event_type": "gpu_trace",
                    "severity": "info",
                    "payload": {"message": msg, "progress_pct": int((frame_idx / max_scan_frames) * 100)}
                }).execute()
            
            # Exit condition
            if unique_players_found >= 10 and len(collected_samples) >= 120:
                print(f"[STAGE 2] Goal Reached: {unique_players_found} players, {len(collected_samples)} samples.")
                break 
                
            frame_idx += 1
            
        cap.release()
        
        if len(collected_samples) < 10:
            raise Exception(f"Insufficient jersey samples ({len(collected_samples)}). Ensure players are visible in the first 8 minutes.")
            
        # Group all samples into 2 teams
        kmeans = KMeans(n_clusters=2, n_init=10)
        kmeans.fit(np.array(collected_samples))
        team_colors = kmeans.cluster_centers_
        
        # Order by brightness: Home (lighter) vs Away
        sorted_colors = sorted(team_colors.tolist(), key=lambda c: sum(c), reverse=True)
        
        home_hex = f"#{int(sorted_colors[0][2]):02x}{int(sorted_colors[0][1]):02x}{int(sorted_colors[0][0]):02x}"
        away_hex = f"#{int(sorted_colors[1][2]):02x}{int(sorted_colors[1][1]):02x}{int(sorted_colors[1][0]):02x}"
        
        # Save results
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "metadata": {"colors": {"home": home_hex, "away": away_hex}, "pipeline_version": "8.7"},
            "status": "calibration_complete",
            "updated_at": "now()"
        }).execute()
        
        print(f"[STAGE 2] SUCCESS: Home({home_hex}) Away({away_hex})")
        return {"status": "success", "colors": {"home": home_hex, "away": away_hex}}
        
    except Exception as e:
        print(f"[STAGE 2] Error: {str(e)}")
        return {"status": "error", "message": str(e)}

# ============================================================================
# STAGE 3: FULL ANALYTICS INFERENCE
# ============================================================================
def stage3_inference(video_url: str, game_id: str):
    print(f"[STAGE 3] Initializing full scouting inference for game {game_id}")
    return {"status": "success", "message": "Inference stage initialized"}

@app.function(
    image=image,
    gpu="any",
    timeout=600,
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
            stage = body.get("stage")
            
            # Diagnostic: Verify credentials presence before starting
            s_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
            s_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
            
            # Log to Modal Console (internal)
            print(f"[DIAGNOSTIC] Stage: {stage}")
            print(f"[DIAGNOSTIC] URL Check: {'FOUND' if s_url else 'MISSING'}")
            print(f"[DIAGNOSTIC] Key Check: {'FOUND' if s_key else 'MISSING'}")
            
            if not s_url or not s_key:
                return JSONResponse({
                    "status": "error", 
                    "message": "GPU Environment Credentials Missing",
                    "diagnostics": {
                        "url_found": bool(s_url),
                        "key_found": bool(s_key)
                    }
                }, status_code=500)
            
            game_id = body.get("game_id")
            video_url = body.get("video_url")
            mode = body.get("pipeline_mode")
            
            if mode == "ping": return JSONResponse(content={"status": "warm"})
            if not all([game_id, video_url]): return JSONResponse({"error": "Missing params"}, 400)
            
            if mode in ["stage2_calibration", "color_calibration"]:
                result = stage2_calibration(video_url, game_id)
                return JSONResponse(content=result)
                
            if mode in ["stage3_inference", "analyze"]:
                result = stage3_inference(video_url, game_id)
                return JSONResponse(content=result)
                
            return JSONResponse(content={"status": "error", "message": "Invalid mode"}, status_code=400)
        except Exception as e:
            return JSONResponse({"status": "error", "message": str(e), "traceback": traceback.format_exc()}, 500)
            
    return web_app
