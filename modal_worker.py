import modal
import os

# MODAL_ELITE_PIPELINE v8.1 - Basketball Scouting AI
# Optimized for Indoor Lighting + Advanced Color Calibration
# Integration: YOLO11m + Roboflow Universe Dataset logic

app = modal.App("basketball-scout-ai")

# Persistent volume for weights and caching
volume = modal.Volume.from_name("basketball-cache", create_if_missing=True)

# Image with scikit-learn and advanced CV libraries
image = (
    modal.Image.from_registry("ultralytics/ultralytics:latest")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "requests",
        "opencv-python-headless",
        "numpy",
        "supabase",
        "boto3",
        "scikit-learn",
        "roboflow"
    )
)

# ============================================================================
# ADVANCED COLOR DETECTION ENGINE
# ============================================================================
class BasketballJerseyColorDetector:
    def __init__(self, yolo_model_path='yolo11m.pt', confidence_threshold=0.5):
        from ultralytics import YOLO
        import cv2
        import numpy as np
        from collections import defaultdict
        
        """
        Initialize basketball jersey color detector
        """
        self.model = YOLO(yolo_model_path)
        self.confidence_threshold = confidence_threshold
        
        # Color clustering parameters (optimized for indoor lighting)
        self.n_dominant_colors = 2
        self.min_saturation = 0.15  # Filter out grays/whites
        self.min_value = 0.20  # Filter out very dark colors
        
        # Tracking parameters
        self.color_history = defaultdict(list)
        self.max_history = 30  # frames to average
        
    def preprocess_for_indoor_lighting(self, image):
        import cv2
        """
        Enhance image for indoor basketball court lighting
        """
        # Convert to LAB color space for better color separation
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        
        # Apply CLAHE to L channel for better contrast
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        
        # Convert back to BGR
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    def extract_dominant_colors(self, crop):
        import cv2
        import numpy as np
        from sklearn.cluster import KMeans
        
        # Resize for speed
        crop = cv2.resize(crop, (50, 50))
        # Convert to HSV for better filtering
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        
        # Reshape for clustering
        pixels = hsv.reshape(-1, 3).astype(np.float32)
        
        # Filter out background pixels (low saturation or low value)
        mask = (pixels[:, 1] > self.min_saturation * 255) & (pixels[:, 2] > self.min_value * 255)
        filtered_pixels = pixels[mask]
        
        if len(filtered_pixels) < 100:
            return None
            
        kmeans = KMeans(n_clusters=self.n_dominant_colors, n_init=5)
        kmeans.fit(filtered_pixels)
        
        # Get the cluster with the highest saturation (likely the jersey primary color)
        centers = kmeans.cluster_centers_
        # Convert back to BGR for output
        bgr_centers = [cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_HSV2BGR)[0][0] for c in centers]
        return bgr_centers

# ============================================================================
# STAGE 2: JERSEY CALIBRATION & TEAM ASSIGNMENT
# ============================================================================
def stage2_calibration(video_url: str, game_id: str):
    import cv2
    import numpy as np
    from supabase import create_client
    from sklearn.cluster import KMeans
    
    print(f"[STAGE 2] Calibrating colors for game {game_id}")
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not all([supabase_url, supabase_key]): return {"status": "error", "message": "Missing credentials"}
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        detector = BasketballJerseyColorDetector()
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened(): raise Exception("Video source unreachable")
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        # Sample points every 10 seconds in the first 5 minutes
        sample_points = [int(fps * s) for s in range(10, 300, 10)]
        collected_samples = []
        
        for frame_idx in sample_points:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret: continue
            
            enhanced = detector.preprocess_for_indoor_lighting(frame)
            # Use YOLO11m to find people (class 0)
            results = detector.model(enhanced, classes=[0], conf=detector.confidence_threshold, verbose=False)
            
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    # Extract the middle horizontal band of the player (jersey area)
                    h_total = y2 - y1
                    jersey_crop = enhanced[y1 + int(h_total*0.15):y1 + int(h_total*0.55), x1:x2]
                    
                    if jersey_crop.size < 100: continue
                    
                    colors = detector.extract_dominant_colors(jersey_crop)
                    if colors:
                        collected_samples.extend(colors)
            
            if len(collected_samples) > 100: break
            
        cap.release()
        
        if len(collected_samples) < 10:
            raise Exception("Insufficient jersey color samples detected in first 5 minutes")
            
        # Group all samples into 2 teams
        kmeans = KMeans(n_clusters=2, n_init=10)
        kmeans.fit(np.array(collected_samples))
        team_colors = kmeans.cluster_centers_
        
        # Order by brightness: Home (typically lighter) vs Away
        sorted_colors = sorted(team_colors.tolist(), key=lambda c: sum(c), reverse=True)
        
        home_hex = f"#{int(sorted_colors[0][2]):02x}{int(sorted_colors[0][1]):02x}{int(sorted_colors[0][0]):02x}"
        away_hex = f"#{int(sorted_colors[1][2]):02x}{int(sorted_colors[1][1]):02x}{int(sorted_colors[1][0]):02x}"
        
        # Save results
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "metadata": {"colors": {"home": home_hex, "away": away_hex}},
            "status": "calibration_complete",
            "updated_at": "now()"
        }).execute()
        
        return {"status": "success", "colors": {"home": home_hex, "away": away_hex}}
        
    except Exception as e:
        print(f"[STAGE 2] Error: {str(e)}")
        return {"status": "error", "message": str(e)}

# ============================================================================
# STAGE 3: FULL ANALYTICS INFERENCE
# ============================================================================
def stage3_inference(video_url: str, game_id: str):
    # Placeholder for full scouting inference (tracking + possession + mapping)
    print(f"[STAGE 3] Running analytics inference for game {game_id}")
    return {"status": "success", "message": "Inference stage initialized"}

@app.function(
    image=image, gpu="A10G", timeout=3600, volumes={"/data": volume},
    secrets=[
        modal.Secret.from_dict({
            "NEXT_PUBLIC_SUPABASE_URL": os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""),
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
            "ROBOFLOW_API_KEY": os.environ.get("ROBOFLOW_API_KEY", "")
        })
    ]
)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    import traceback
    
    web_app = FastAPI()
    
    @web_app.post("/")
    async def endpoint(request: Request):
        try:
            data = await request.json()
            game_id = data.get("game_id") or data.get("gameId")
            video_url = data.get("video_url") or data.get("videoUrl")
            mode = data.get("pipeline_mode")
            
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
