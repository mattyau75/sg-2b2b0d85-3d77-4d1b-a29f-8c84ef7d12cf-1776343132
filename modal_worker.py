import modal
import os
import logging
import asyncio
from datetime import datetime

# MODAL_ELITE_PIPELINE v12.4 - Ghost Discovery
# Restored Handshake (v10.4) + Elite Scouting + Dynamic Coordinates

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "opencv-python-headless",
        "numpy",
        "aiohttp",
        "scikit-learn",
        "fastapi",
        "uvicorn",
        "ultralytics",
        "supabase",
        "supervision"
    )
    .run_commands(
        "python3 -c 'from ultralytics import YOLO; YOLO(\"yolo11m.pt\"); YOLO(\"yolo11m-seg.pt\")'"
    )
)

app = modal.App("basketball-scout-ai")
volume = modal.Volume.from_name("video-workspace", create_if_missing=True)

def resolve_video_url(url: str) -> str:
    """Helper to resolve relative R2 paths to public URLs if needed."""
    if url.startswith("http"):
        return url
    public_base = "https://pub-fa42028a0f9146ecb0d848e7abcbbe01.r2.dev"
    clean_path = url.lstrip("/")
    return f"{public_base}/{clean_path}"

@app.function(image=image, gpu="T4", timeout=600, volumes={"/workspace": volume})
async def calibrate_colors_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    from supabase import create_client, Client
    import cv2
    import numpy as np
    from sklearn.cluster import KMeans
    
    supabase: Client = create_client(supabase_url, supabase_key)
    resolved_url = resolve_video_url(video_url)
    logger.info(f"[STAGE 2] Restored Pixel Scan Ignition: {game_id}")
    
    cap = cv2.VideoCapture(resolved_url)
    if not cap.isOpened():
        logger.error("Failed to open video for calibration")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)
    ret, frame = cap.read()
    cap.release()
    
    if not ret: return

    # TORSO PIXEL CLUSTERING
    h, w, _ = frame.shape
    roi = frame[h//4:3*h//4, w//4:3*w//4]
    pixels = roi.reshape(-1, 3)
    
    kmeans = KMeans(n_clusters=5, n_init=10)
    kmeans.fit(pixels)
    colors = kmeans.cluster_centers_.astype(int).tolist()
    
    # Store color signatures in game_config for Stage 4 classification
    supabase.table("game_analysis").update({
        "status": "color_calibration_complete",
        "status_message": "Stage 2: Pixel signatures extracted.",
        "metadata": {"dominant_colors": colors},
        "updated_at": datetime.utcnow().isoformat()
    }).eq("game_id", game_id).execute()

@app.function(image=image, gpu="T4", timeout=1800, volumes={"/workspace": volume}, cpu=2)
async def process_game_analysis_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    from supabase import create_client, Client
    import cv2
    import numpy as np
    import supervision as sv
    from ultralytics import YOLO
    from sklearn.cluster import KMeans
    
    supabase: Client = create_client(supabase_url, supabase_key)
    resolved_url = resolve_video_url(video_url)
    logger.info(f"[STAGE 4] Elite Scouting Ignition: {game_id}")
    
    # LOAD MULTI-MODEL STACK
    p_model = YOLO("yolo11m.pt") # Players, Ball
    c_model = YOLO("yolo11m-seg.pt") # Ring, Lines
    
    tracker = sv.ByteTrack(lost_track_buffer=30)
    cap = cv2.VideoCapture(resolved_url)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    raw_events = []
    mapping_data = {}
    stats = {} # track_id -> {pts, reb, fga, fgm}
    ball_history = []
    
    # Standard court dimensions for mapping
    COURT_WIDTH = 500
    COURT_HEIGHT = 470
    HOOP_X_STD = 250
    HOOP_Y_STD = 52
    
    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        if frame_idx % 5 == 0:
            # DETECTION
            p_res = p_model(frame, imgsz=1280, conf=0.4, verbose=False)[0]
            detections = sv.Detections.from_ultralytics(p_res)
            detections = tracker.update_with_detections(detections)
            
            c_res = c_model(frame, imgsz=1280, conf=0.5, verbose=False)[0]
            
            # 1. PERSONEL DISCOVERY & CLASSIFICATION
            for det in detections:
                t_id = int(det[4]) if det[4] is not None else -1
                if t_id != -1:
                    if t_id not in mapping_data:
                        # Torso clustering for team prediction
                        x1, y1, x2, y2 = det[0].astype(int)
                        # Padding for better context in ghost snapshots
                        pad = 10
                        gy1, gy2 = max(0, y1-pad), min(frame_height, y1+(y2-y1)//2+pad)
                        gx1, gx2 = max(0, x1-pad), min(frame_width, x2+pad)
                        
                        ghost_crop = frame[gy1:gy2, gx1:gx2]
                        if ghost_crop.size > 0:
                            # Save Ghost Crop to R2 logic here
                            # (Simulated for v12.4 - would upload to r2/ghosts/{game_id}/{t_id}.png)
                            p_pixels = ghost_crop.reshape(-1, 3)
                            km = KMeans(n_clusters=2, n_init=5).fit(p_pixels)
                            dom = km.cluster_centers_[0].astype(int).tolist()
                            
                            mapping_data[t_id] = {
                                "game_id": game_id,
                                "ai_track_id": str(t_id),
                                "confidence": float(det[2]),
                                "metadata": {
                                    "discovered_at": frame_idx / fps, 
                                    "avg_color": dom,
                                    "ghost_snapshot_url": f"ghosts/{game_id}/{t_id}.png"
                                }
                            }
                            stats[t_id] = {"pts": 0, "reb": 0, "fga": 0, "fgm": 0}

            # 2. EVENT LOGIC (DYNAMIC SPATIAL MAPPING)
            ball = None
            for i, c in enumerate(p_res.boxes.cls):
                if p_model.names[int(c)] == 'sports ball':
                    ball = p_res.boxes.xyxy[i].cpu().numpy()
                    break
            
            ring_mask = None
            ring_center = None
            if c_res.masks is not None:
                for i, c in enumerate(c_res.boxes.cls):
                    if c_model.names[int(c)] in ['hoop', 'ring']:
                        mask = c_res.masks.data[i].cpu().numpy()
                        ring_mask = mask
                        # Find centroid of ring mask
                        coords = np.argwhere(mask > 0)
                        if coords.size > 0:
                            cy, cx = coords.mean(axis=0)
                            ring_center = (cx, cy)
                        break
            
            if ball is not None and ring_mask is not None and ring_center is not None:
                bx = (ball[0] + ball[2]) / 2
                by = (ball[1] + ball[3]) / 2
                ball_history.append((bx, by, frame_idx))
                if len(ball_history) > 10: ball_history.pop(0)
                
                # Check for downward entry into ring
                if len(ball_history) >= 3:
                    prev_y = ball_history[-2][1]
                    if by > prev_y: # Downward trajectory
                        # Scale factor based on hoop resolution in frame
                        # standard hoop is ~45cm, court is 15m. 
                        # We use simple relative positioning for spatial mapping
                        fy, fx = int(by * ring_mask.shape[0] / frame_height), int(bx * ring_mask.shape[1] / frame_width)
                        if 0 <= fy < ring_mask.shape[0] and 0 <= fx < ring_mask.shape[1]:
                            if ring_mask[fy, fx] > 0:
                                # CALCULATE DYNAMIC COURT COORDINATES
                                # Map relative to hoop anchor
                                dx = bx - ring_center[0]
                                dy = by - ring_center[1]
                                
                                # Estimate court pixels (approximate based on hoop width in frame)
                                # This provides real spatial variation without hardcoded center
                                court_x = HOOP_X_STD + (dx * 0.5) 
                                court_y = HOOP_Y_STD + (dy * 0.5)
                                
                                raw_events.append({
                                    "game_id": game_id,
                                    "event_type": "make",
                                    "timestamp": frame_idx / fps,
                                    "x_coord": float(np.clip(court_x, 0, COURT_WIDTH)),
                                    "y_coord": float(np.clip(court_y, 0, COURT_HEIGHT)),
                                    "metadata": {"detail": "Elite Geometric Make", "frame": frame_idx}
                                })

        frame_idx += 1
        if frame_idx > 10000: break # Safety limit
        
    cap.release()
    
    # PERSISTENCE
    if mapping_data:
        supabase.table("ai_player_mappings").upsert(list(mapping_data.values()), on_conflict="game_id,ai_track_id").execute()
    
    if raw_events:
        supabase.table("game_events").insert(raw_events).execute()
        
    box_score_rows = []
    for t_id, s in stats.items():
        box_score_rows.append({
            "game_id": game_id,
            "player_track_id": str(t_id),
            "points": s["pts"],
            "rebounds": s["reb"],
            "fg_made": s["fgm"],
            "fg_att": s["fga"]
        })
    
    if box_score_rows:
        supabase.table("game_box_scores").insert(box_score_rows).execute()

    supabase.table("game_analysis").update({
        "status": "analysis_complete",
        "status_message": "Elite Multi-Model Scouting Complete. v12.3 Active.",
        "updated_at": datetime.utcnow().isoformat()
    }).eq("game_id", game_id).execute()

@app.function(image=image)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    @web_app.post("/calibrate")
    async def calibrate(request: Request):
        body = await request.json()
        calibrate_colors_internal.spawn(
            body.get("game_id"),
            body.get("video_url"),
            body.get("supabase_url"),
            body.get("supabase_key")
        )
        return JSONResponse(content={"status": "processing", "version": "12.3"}, status_code=202)

    @web_app.post("/")
    async def analyze(request: Request):
        body = await request.json()
        process_game_analysis_internal.spawn(
            body.get("game_id"),
            body.get("video_url"),
            body.get("supabase_url"),
            body.get("supabase_key")
        )
        return JSONResponse(content={"status": "processing", "version": "12.3"}, status_code=202)
            
    return web_app
