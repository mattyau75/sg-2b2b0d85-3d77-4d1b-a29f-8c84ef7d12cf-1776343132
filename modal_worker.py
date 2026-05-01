import modal
import os
import logging
import asyncio

# MODAL_ELITE_PIPELINE v10.1 - Semantic Segmentation & ByteTrack
# Utilizing YOLO11m-Seg for pixel-perfect jersey isolation

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
    .run_commands("python3 -c 'from ultralytics import YOLO; YOLO(\"yolo11m-seg.pt\")'")
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
        logger.info(f"[START] Elite Segmentation Pipeline: {game_id}")
        
        # 1. DOWNLOAD (Streaming)
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url) as resp:
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        await volume.commit.aio()

        # 2. VISION INITIALIZATION (Segmentation Model)
        model = YOLO("yolo11m-seg.pt") 
        byte_tracker = sv.ByteTrack(track_buffer=30)
        cap = cv2.VideoCapture(local_path)
        
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sample_indices = np.linspace(300, min(5000, frame_count - 1), 25).astype(int)
        
        jersey_pixels = []
        
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret: continue

            # High-Res Segmentation Inference
            results = model(frame, imgsz=1280, classes=[0], conf=0.6, verbose=False)[0]
            
            if not results.masks: continue
            
            detections = sv.Detections.from_ultralytics(results)
            detections = byte_tracker.update_with_detections(detections)
            
            # Extract pixels using segmentation masks (Isolates player from background)
            for i, mask in enumerate(results.masks.data):
                # Convert mask to numpy and resize to match frame
                m = mask.cpu().numpy()
                m = cv2.resize(m, (frame.shape[1], frame.shape[0]))
                
                # Apply mask to frame
                masked_player = cv2.bitwise_and(frame, frame, mask=m.astype(np.uint8))
                
                # Further refine to torso ROI to avoid shoes/hair
                x1, y1, x2, y2 = map(int, results.boxes.xyxy[i])
                h = y2 - y1
                # Torso isolation
                torso_mask = np.zeros_like(m)
                torso_mask[y1 + int(h*0.1):y1 + int(h*0.5), :] = 1
                final_mask = cv2.bitwise_and(m, torso_mask)
                
                pixels = frame[final_mask > 0].reshape(-1, 3)
                if pixels.size > 0:
                    # Filter out skin tones
                    lab = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3)
                    # L range (Lightness) and skin color range (a/b)
                    # This is a heuristic - we'll use clustering to find the dominant fabric
                    jersey_pixels.append(pixels[np.random.choice(pixels.shape[0], min(100, pixels.shape[0]), replace=False)])

        cap.release()
        
        if not jersey_pixels:
            raise Exception("No stable segmentation signatures detected.")

        pixel_stack = np.vstack(jersey_pixels)
        
        # 3. K-MEANS WITH SKIN REJECTION
        kmeans = KMeans(n_clusters=8, n_init=5)
        kmeans.fit(pixel_stack)
        centers = kmeans.cluster_centers_

        def is_skin_tone(bgr):
            hsv = cv2.cvtColor(np.uint8([[bgr]]), cv2.COLOR_BGR2HSV)[0][0]
            # S < 20 often means gray/white, H > 25 often means not-skin
            return (0 <= hsv[0] <= 25) and (25 <= hsv[1] <= 150)

        valid_centers = [c for c in centers if not is_skin_tone(c)]
        if not valid_centers: valid_centers = centers

        def bgr_to_hex(bgr):
            return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))

        # Perceptual Sorting
        lum = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in valid_centers]
        idx = np.argsort(lum)
        
        home_hex = bgr_to_hex(valid_centers[idx[-1]]) # Lighter
        away_hex = bgr_to_hex(valid_centers[idx[0]])  # Darker

        # 4. PERSISTENCE
        now = datetime.utcnow().isoformat()
        
        # Update game_config (Source of truth for calibration)
        supabase.table("game_config").upsert({
            "game_id": game_id,
            "home_color_hex": home_hex,
            "away_color_hex": away_hex,
            "updated_at": now
        }, on_conflict="game_id").execute()

        # Mirror to games table for immediate discovery
        supabase.table("games").update({
            "home_team_color": home_hex,
            "away_team_color": away_hex,
            "colors_verified": False
        }).eq("id", game_id).execute()

        # Signal ready
        supabase.table("game_analysis").update({
            "status": "calibration_ready",
            "status_message": f"Segmentation Lock: {home_hex} / {away_hex}",
            "updated_at": now
        }).eq("game_id", game_id).execute()

        logger.info(f"[SUCCESS] {home_hex} / {away_hex}")

    except Exception as e:
        logger.exception("Elite Pipeline Failure")
        try:
            supabase.table("game_analysis").update({
                "status": "error",
                "status_message": str(e)
            }).eq("game_id", game_id).execute()
        except: pass

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
        
        background_tasks.add_task(
            calibrate_colors_internal.remote.aio, 
            game_id, video_url, supabase_url, supabase_key
        )
        
        return JSONResponse(content={"status": "processing"}, status_code=202)
            
    return web_app
