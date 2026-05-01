import modal
import os
import logging
import asyncio

# MODAL_ELITE_PIPELINE v9.12 - Syntax Fix & Performance Optimization
# Pre-baking YOLO11m into the image to eliminate download latency

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
        "supabase"
    )
    # Pre-download the model into the image for speed
    .run_commands("python3 -c 'from ultralytics import YOLO; YOLO(\"yolo11m.pt\")'")
)

app = modal.App("basketball-scout-ai")
volume = modal.Volume.from_name("video-workspace", create_if_missing=True)

@app.function(
    image=image,
    gpu="T4",
    timeout=600,
    volumes={"/workspace": volume}
)
async def calibrate_colors_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    import cv2
    import numpy as np
    from ultralytics import YOLO
    from sklearn.cluster import KMeans
    from supabase import create_client, Client
    from datetime import datetime
    
    local_path = f"/workspace/{game_id}.mp4"
    supabase: Client = create_client(supabase_url, supabase_key)
    
    try:
        logger.info(f"[START] Torso-Gated Scan: {game_id}")
        
        # 1. DOWNLOAD (Streaming to avoid OOM)
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url) as resp:
                if resp.status not in [200, 206]:
                    raise Exception(f"Video host returned {resp.status}")
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        await volume.commit.aio()

        # 2. YOLO DETECTION (v11m) - Now instant because it's pre-baked
        model = YOLO("yolo11m.pt") 
        cap = cv2.VideoCapture(local_path)
        
        player_crops_pixels = []
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if frame_count <= 0:
            raise Exception("Could not read frame count from video.")

        # Sample 15 frames distributed through the first 3000 frames (approx 1.5 mins)
        sample_indices = np.linspace(300, min(3000, frame_count - 1), 15).astype(int)

        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret: continue

            results = model(frame, classes=[0], conf=0.5, verbose=False)
            for result in results:
                for box in result.boxes.xyxy:
                    x1, y1, x2, y2 = map(int, box)
                    
                    # TORSO-GATING: Focus on the upper-middle of the player box
                    h = y2 - y1
                    w = x2 - x1
                    # Isolate jersey area, excluding hair and legs
                    crop = frame[y1 + int(h*0.1):y1 + int(h*0.6), x1 + int(w*0.2):x1 + int(w*0.8)]
                    
                    if crop.size > 0:
                        # LIGHTING NORMALIZATION: Apply CLAHE to handle shadows
                        lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
                        l, a, b = cv2.split(lab)
                        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
                        cl = clahe.apply(l)
                        limg = cv2.merge((cl,a,b))
                        normalized = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
                        
                        # Resize for cluster efficiency
                        small = cv2.resize(normalized, (30, 30))
                        player_crops_pixels.append(small.reshape(-1, 3))

        cap.release()
        
        if not player_crops_pixels:
            raise Exception("No players detected for color signature.")

        pixels = np.vstack(player_crops_pixels)
        
        # 3. K-MEANS WITH SKIN REJECTION
        kmeans = KMeans(n_clusters=8, n_init=5)
        kmeans.fit(pixels)
        centers = kmeans.cluster_centers_

        def is_skin_tone(bgr):
            hsv = cv2.cvtColor(np.uint8([[bgr]]), cv2.COLOR_BGR2HSV)[0][0]
            # Standard skin tone range
            return (0 <= hsv[0] <= 25) and (20 <= hsv[1] <= 150)

        # Filter out skin and court-floor browns
        valid_centers = [c for c in centers if not is_skin_tone(c)]
        if not valid_centers: valid_centers = centers

        def bgr_to_hex(bgr):
            return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))

        # Sort by luminosity
        lum = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in valid_centers]
        idx = np.argsort(lum)
        
        home_hex = bgr_to_hex(valid_centers[idx[-1]]) # Lightest
        away_hex = bgr_to_hex(valid_centers[idx[0]])  # Darkest

        # 4. ATOMIC PERSISTENCE
        now = datetime.utcnow().isoformat()
        
        # Update config FIRST
        supabase.table("game_config").upsert({
            "game_id": game_id,
            "home_color_hex": home_hex,
            "away_color_hex": away_hex,
            "updated_at": now
        }, on_conflict="game_id").execute()

        # Update main games table - FIXED SYNTAX (False not false)
        supabase.table("games").update({
            "home_team_color": home_hex,
            "away_team_color": away_hex,
            "colors_verified": False
        }).eq("id", game_id).execute()

        # Mark analysis as ready LAST
        supabase.table("game_analysis").update({
            "status": "calibration_ready",
            "status_message": "Jersey signatures locked.",
            "updated_at": now
        }).eq("game_id", game_id).execute()

        logger.info(f"[SUCCESS] {home_hex} / {away_hex}")

    except Exception as e:
        logger.exception("GPU Pipeline Failure")
        # Ensure error is reported to DB
        try:
            supabase.table("game_analysis").update({
                "status": "error",
                "status_message": str(e)
            }).eq("game_id", game_id).execute()
        except:
            pass

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
        
        return JSONResponse({"status": "processing"}, 202)
            
    return web_app
