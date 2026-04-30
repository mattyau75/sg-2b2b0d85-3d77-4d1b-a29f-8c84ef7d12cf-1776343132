import modal
import os
import logging
import asyncio

# MODAL_ELITE_PIPELINE v9.10 - YOLO11m Object-Gated Vision
# High-precision player isolation for elite jersey signature extraction

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
    import aiohttp
    from datetime import datetime
    
    local_path = f"/workspace/{game_id}.mp4"
    supabase: Client = create_client(supabase_url, supabase_key)
    
    try:
        logger.info(f"[START] YOLO11m Object-Gated Scan: {game_id}")
        
        # 1. STREAMING DOWNLOAD
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url, timeout=aiohttp.ClientTimeout(total=600)) as resp:
                if resp.status not in [200, 206]:
                    raise Exception(f"Video host returned {resp.status}")
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        await volume.commit.aio()

        # 2. LOAD YOLO11m
        # Using yolo11m (medium) for optimal accuracy/speed balance on 1080p
        model = YOLO("yolo11m.pt") 
        
        cap = cv2.VideoCapture(local_path)
        if not cap.isOpened(): raise Exception("FFmpeg/Codec Error")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # Sample 20 frames from the first 3 minutes where lineups are clear
        sample_indices = np.linspace(300, min(5400, frame_count - 1), 20).astype(int)
        
        player_crops_pixels = []
        
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret: continue
            
            # 3. YOLO DETECTION
            # Only detect 'person' (class 0)
            results = model(frame, classes=[0], conf=0.45, verbose=False)
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # Get bounding box coordinates
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    
                    # Extract the player crop
                    # Focus on the 'jersey zone' (upper 60% of the player box)
                    player_h = y2 - y1
                    jersey_y2 = y1 + int(player_h * 0.6)
                    crop = frame[y1:jersey_y2, x1:x2]
                    
                    if crop.size == 0: continue
                    
                    # 4. LIGHTING NORMALIZATION (CIE Lab)
                    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
                    l, a, b = cv2.split(lab)
                    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
                    cl = clahe.apply(l)
                    limg = cv2.merge((cl,a,b))
                    crop_norm = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
                    
                    # Resize to a small patch for K-Means efficiency
                    small_crop = cv2.resize(crop_norm, (40, 40))
                    pixels = small_crop.reshape(-1, 3)
                    player_crops_pixels.append(pixels)

        cap.release()
        
        if not player_crops_pixels: 
            raise Exception("Vision: YOLO found 0 players. Check video quality or URL.")

        pixel_stack = np.vstack(player_crops_pixels)
        
        # 5. K-MEANS CLUSTERING (12 clusters for finer separation)
        kmeans = KMeans(n_clusters=12, n_init=10)
        kmeans.fit(pixel_stack)
        centers = kmeans.cluster_centers_
        
        def is_skin_tone(bgr):
            # Convert to HSV for better skin detection
            hsv = cv2.cvtColor(np.uint8([[bgr]]), cv2.COLOR_BGR2HSV)[0][0]
            h, s, v = hsv
            # Standard skin tone range in HSV
            return (0 <= h <= 25) and (20 <= s <= 150)

        # Filter out skin tones before picking light/dark
        non_skin_centers = [c for c in centers if not is_skin_tone(c)]
        
        # Fallback if all look like skin (shouldn't happen with jerseys)
        target_centers = non_skin_centers if non_skin_centers else centers

        def bgr_to_hex(bgr):
            return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))

        # Sort by Perceptual Luminosity
        luminosities = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in target_centers]
        sorted_idx = np.argsort(luminosities)
        
        # Pick the most distinct light and dark non-skin colors
        home_hex = bgr_to_hex(target_centers[sorted_idx[-1]]) # Lightest
        away_hex = bgr_to_hex(target_centers[sorted_idx[0]])  # Darkest
        
        # 6. PERSIST RESULTS
        now = datetime.utcnow().isoformat()
        
        # Update Games Table (Main Detail Page)
        supabase.table("games").update({
            "home_team_color": home_hex,
            "away_team_color": away_hex,
            "colors_verified": False
        }).eq("id", game_id).execute()

        # Update Config Table (Polling Source)
        supabase.table("game_config").upsert({
            "game_id": game_id,
            "home_color_hex": home_hex,
            "away_color_hex": away_hex,
            "updated_at": now
        }, on_conflict="game_id").execute()

        # Update Analysis Status
        supabase.table("game_analysis").update({
            "status": "calibration_ready",
            "metadata": {"colors": {"home": home_hex, "away": away_hex}, "scan_version": "11m-9.10"}
        }).eq("game_id", game_id).execute()

        logger.info(f"[SUCCESS] YOLO11m Signatures Locked: {home_hex} / {away_hex}")
        
        if os.path.exists(local_path):
            os.remove(local_path)
            await volume.commit.aio()

    except Exception as e:
        logger.exception("[FATAL] YOLO Pipeline Failure")
        supabase.table("game_analysis").update({
            "status": "error",
            "status_message": f"Vision Error: {str(e)}"
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
        try:
            body = await request.json()
            game_id = body.get("game_id")
            video_url = body.get("video_url")
            supabase_url = body.get("supabase_url")
            supabase_key = body.get("supabase_key")
            
            if not all([game_id, video_url, supabase_url, supabase_key]):
                return JSONResponse(content={"status": "error", "message": "Missing credentials"}, status_code=400)

            background_tasks.add_task(
                calibrate_colors_internal.remote.aio, 
                game_id, video_url, supabase_url, supabase_key
            )
            
            return JSONResponse(content={"status": "processing", "message": "YOLO11m Ignition successful."}, status_code=202)
        except Exception as e:
            return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
            
    return web_app
