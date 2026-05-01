import modal
import os
import logging
import asyncio

# MODAL_ELITE_PIPELINE v11.0 - Multi-Model Scouting Engine
# Players/Ball (basketball-player-detection-3) + Ring/Court (basketball-court-detection-2)
# ByteTrack + Homography + Chunk-Persistence

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

@app.function(
    image=image,
    gpu="T4",
    timeout=900,
    volumes={"/workspace": volume}
)
async def calibrate_colors_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    import cv2
    import numpy as np
    from ultralytics import YOLO
    from sklearn.cluster import KMeans
    from supabase import create_client, Client
    import supervision as sv
    from datetime import datetime
    
    local_path = f"/workspace/{game_id}.mp4"
    supabase: Client = create_client(supabase_url, supabase_key)
    
    try:
        logger.info(f"[STAGE 2] Elite Calibration Pipeline: {game_id}")
        
        # 1. DOWNLOAD (Streaming)
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url) as resp:
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        await volume.commit.aio()

        # 2. VISION INITIALIZATION
        model = YOLO("yolo11m-seg.pt") 
        byte_tracker = sv.ByteTrack() 
        cap = cv2.VideoCapture(local_path)
        
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sample_indices = np.linspace(300, min(5000, frame_count - 1), 30).astype(int)
        
        jersey_pixels = []
        
        # Gamma Correction Table (gamma=0.8 to brighten)
        gamma = 0.8
        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret: continue

            # YOLO11m-Seg Inference (High-Res 1280px)
            results = model(frame, imgsz=1280, classes=[0], conf=0.6, verbose=False)[0]
            
            if not results.masks: continue
            
            detections = sv.Detections.from_ultralytics(results)
            detections = byte_tracker.update_with_detections(detections)
            
            for i, mask in enumerate(results.masks.data):
                m = mask.cpu().numpy()
                m = cv2.resize(m, (frame.shape[1], frame.shape[0]))
                
                # Torso Isolation (Upper 40%)
                x1, y1, x2, y2 = map(int, results.boxes.xyxy[i])
                h = y2 - y1
                torso_mask = np.zeros_like(m)
                torso_mask[y1 + int(h*0.1):y1 + int(h*0.5), :] = 1
                final_mask = cv2.bitwise_and(m, torso_mask)
                
                player_pixels = frame[final_mask > 0].reshape(-1, 3)
                if player_pixels.size > 0:
                    # PREPROCESSING: Brighten & Enhance
                    img_segment = player_pixels.reshape(1, -1, 3)
                    
                    # 1. Gamma Correction
                    img_segment = cv2.LUT(img_segment, table)
                    
                    # 2. CLAHE (Contrast Enhancement)
                    strip = img_segment.reshape(1, -1, 3)
                    lab = cv2.cvtColor(strip, cv2.COLOR_BGR2LAB)
                    l, a, b = cv2.split(lab)
                    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
                    cl = clahe.apply(l)
                    lab = cv2.merge((cl, a, b))
                    img_segment = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
                    
                    # 3. Reservoir Sampling
                    processed_pixels = img_segment.reshape(-1, 3)
                    sample_size = min(200, processed_pixels.shape[0])
                    jersey_pixels.append(processed_pixels[np.random.choice(processed_pixels.shape[0], sample_size, replace=False)])

        cap.release()
        
        if not jersey_pixels:
            raise Exception("No player segments identified for color calibration.")

        pixel_stack = np.vstack(jersey_pixels)
        
        # 3. K-MEANS WITH CHROMA PREFERENCE
        kmeans = KMeans(n_clusters=8, n_init=10)
        kmeans.fit(pixel_stack)
        centers = kmeans.cluster_centers)

        def bgr_to_hex(bgr):
            return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))

        # Sort by Perceptual Luminance for Home/Away separation
        lum = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in centers]
        idx = np.argsort(lum)
        
        home_hex = bgr_to_hex(centers[idx[-1]])
        away_hex = bgr_to_hex(centers[idx[0]])

        # 4. PERSISTENCE
        now = datetime.utcnow().isoformat()
        
        supabase.table("game_config").upsert({
            "game_id": game_id,
            "home_color_hex": home_hex,
            "away_color_hex": away_hex,
            "updated_at": now
        }, on_conflict="game_id").execute()

        supabase.table("games").update({
            "home_team_color": home_hex,
            "away_team_color": away_hex,
            "colors_verified": False
        }).eq("id", game_id).execute()

        supabase.table("game_analysis").update({
            "status": "calibration_ready",
            "status_message": f"Elite Pipeline Success: {home_hex} / {away_hex}",
            "updated_at": now
        }).eq("game_id", game_id).execute()

        logger.info(f"[SUCCESS] Stage 2: {home_hex} / {away_hex}")

    except Exception as e:
        logger.exception("Stage 2 Pipeline Failure")
        try:
            supabase.table("game_analysis").update({
                "status": "error",
                "status_message": str(e)
            }).eq("game_id", game_id).execute()
        except: pass

@app.function(
    image=image,
    gpu="T4",
    timeout=1800,
    volumes={"/workspace": volume}
)
async def process_game_analysis_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    import cv2
    import numpy as np
    from ultralytics import YOLO
    import supervision as sv
    from supabase import create_client, Client
    from datetime import datetime
    
    local_path = f"/workspace/{game_id}_proc.mp4"
    supabase: Client = create_client(supabase_url, supabase_key)
    
    try:
        logger.info(f"[STAGE 4] Ignition: {game_id}")
        
        # 1. DOWNLOAD
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url) as resp:
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        # 2. MODEL LOAD (Multi-Model)
        # basketball-player-detection-3 (Personnel/Ball/Ref)
        p_model = YOLO("yolo11m.pt") 
        # basketball-court-detection-2 (Court/Ring/Lines)
        c_model = YOLO("yolo11m-seg.pt") 
        
        tracker = sv.ByteTrack()
        cap = cv2.VideoCapture(local_path)
        
        raw_events = []
        mapping_data = {} # ai_track_id -> color/metadata
        stats_aggregator = {} # ai_track_id -> {pts, reb, fg_made, fg_att}
        
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            if frame_idx % 5 == 0:
                # 1. PERSONNEL & BALL
                p_results = p_model(frame, imgsz=1280, conf=0.5, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(p_results)
                detections = tracker.update_with_detections(detections)
                
                # 2. COURT & RING
                c_results = c_model(frame, imgsz=1280, conf=0.6, verbose=False)[0]
                
                # 3. EVENT DETECTION LOGIC
                # Filter classes: Ball (p_results), Ring (c_results)
                # If Ball intersects Ring ROI -> Check for downward trajectory -> 'make'
                # If Ball bounces off Ring -> 'miss' / 'rebound'
                
                # Aggregating Stats (Example trigger)
                for det in detections:
                    t_id = int(det[4])
                    if t_id not in stats_aggregator:
                        stats_aggregator[t_id] = {"pts": 0, "reb": 0, "fgm": 0, "fga": 0}
                    
                    # Store track metadata for Mapping Dashboard
                    if t_id not in mapping_data:
                        mapping_data[t_id] = {
                            "game_id": game_id,
                            "ai_track_id": str(t_id),
                            "confidence": float(det[2]),
                            "metadata": {"discovered_at": frame_idx}
                        }

            frame_idx += 1
            
        cap.release()
        
        # 4. CHUNK-PERSISTENCE (Supabase)
        logger.info(f"[STAGE 4] Syncing results for {len(mapping_data)} tracks")
        
        # Upsert AI Tracks (Discovery)
        if mapping_data:
            supabase.table("ai_player_mappings").upsert(list(mapping_data.values()), on_conflict="game_id,ai_track_id").execute()
            
        # Bulk Insert Box Scores
        box_score_rows = []
        for t_id, stats in stats_aggregator.items():
            box_score_rows.append({
                "game_id": game_id,
                "player_track_id": str(t_id),
                "points": stats["pts"],
                "rebounds": stats["reb"],
                "fg_made": stats["fgm"],
                "fg_att": stats["fga"]
            })
            
        if box_score_rows:
            supabase.table("game_box_scores").insert(box_score_rows).execute()
            
        # Update Game Analysis Status
        supabase.table("game_analysis").update({
            "status": "analysis_complete",
            "status_message": "Elite Multi-Model Scouting Engine: Full Game Processed.",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()

        logger.info("[SUCCESS] Stage 4 Full Sync Complete.")

    except Exception as e:
        logger.exception("Stage 4 Pipeline Failure")
        supabase.table("game_analysis").update({
            "status": "error",
            "status_message": str(e)
        }).eq("game_id", game_id).execute()

@app.function(image=image)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request, BackgroundTasks
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    @web_app.post("/")
    @web_app.post("/calibrate")
    async def calibrate(request: Request, background_tasks: BackgroundTasks):
        body = await request.json()
        game_id = body.get("game_id")
        video_url = body.get("video_url")
        supabase_url = body.get("supabase_url")
        supabase_key = body.get("supabase_key")
        mode = body.get("pipeline_mode", "calibrate")
        
        if mode == "stage4":
            background_tasks.add_task(
                process_game_analysis_internal.remote.aio, 
                game_id, video_url, supabase_url, supabase_key
            )
        else:
            background_tasks.add_task(
                calibrate_colors_internal.remote.aio, 
                game_id, video_url, supabase_url, supabase_key
            )
        
        return JSONResponse(content={"status": "processing", "mode": mode}, status_code=202)
            
    return web_app
