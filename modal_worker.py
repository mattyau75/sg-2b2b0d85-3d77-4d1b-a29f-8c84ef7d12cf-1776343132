import modal
import os
import logging
import asyncio

# MODAL_ELITE_PIPELINE v9.09 - CIE Lab Precision Engine
# Optimized for high-density player recognition in panning 1080p indoor footage

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
    from sklearn.cluster import KMeans
    from supabase import create_client, Client
    import aiohttp
    from datetime import datetime
    
    local_path = f"/workspace/{game_id}.mp4"
    supabase: Client = create_client(supabase_url, supabase_key)
    
    try:
        logger.info(f"[START] CIE Lab Vision Analysis: {game_id}")
        
        # 1. STREAMING DOWNLOAD (Prevents OOM)
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url, timeout=aiohttp.ClientTimeout(total=600)) as resp:
                if resp.status not in [200, 206]:
                    raise Exception(f"Video host returned {resp.status}")
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        await volume.commit.aio()

        cap = cv2.VideoCapture(local_path)
        if not cap.isOpened(): raise Exception("FFmpeg/Codec Error")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # Sample across the first 5 minutes
        sample_indices = np.linspace(500, min(9000, frame_count - 1), 25).astype(int)
        
        player_pixels = []
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret: continue
            
            # 2. LIGHTING NORMALIZATION
            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl,a,b))
            frame_norm = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

            # 3. ROI GATING (Player Belt)
            h, w = frame_norm.shape[:2]
            roi = frame_norm[int(h*0.35):int(h*0.65), int(w*0.1):int(w*0.9)]
            
            # 4. COURT TONE REJECTION (HSV)
            hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            # Filter court tans, yellows, and browns
            lower_court = np.array([5, 30, 30])
            upper_court = np.array([35, 255, 255])
            mask = cv2.inRange(hsv, lower_court, upper_court)
            
            # Isolate players
            player_only = cv2.bitwise_and(roi, roi, mask=cv2.bitwise_not(mask))
            
            # Resize for speed and filter zero pixels
            small = cv2.resize(player_only, (80, 80))
            pixels = small.reshape(-1, 3)
            # Remove black background from masking
            pixels = pixels[np.any(pixels != [0, 0, 0], axis=1)]
            player_pixels.append(pixels)

        cap.release()
        
        if not player_pixels: raise Exception("Vision: Zero player pixels detected after court masking")

        pixel_stack = np.vstack(player_pixels)
        
        # 5. K-MEANS CLUSTERING (8 clusters for high granularity)
        kmeans = KMeans(n_clusters=8, n_init=10)
        kmeans.fit(pixel_stack)
        centers = kmeans.cluster_centers_
        
        def bgr_to_hex(bgr):
            return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))

        # Sort by Perceptual Luminosity (Home = Light, Away = Dark)
        luminosities = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in centers]
        sorted_idx = np.argsort(luminosities)
        
        # We pick the most distinct high/low values that aren't gray
        home_hex = bgr_to_hex(centers[sorted_idx[-1]]) # Lightest
        away_hex = bgr_to_hex(centers[sorted_idx[0]])  # Darkest
        
        # 6. ELITE SYNC
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
            "metadata": {"colors": {"home": home_hex, "away": away_hex}, "scan_version": "9.09"}
        }).eq("game_id", game_id).execute()

        logger.info(f"[SUCCESS] Lab Signatures Locked: {home_hex} / {away_hex}")
        
        if os.path.exists(local_path):
            os.remove(local_path)
            await volume.commit.aio()

    except Exception as e:
        logger.exception("[FATAL] GPU Pipeline Failure")
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
            
            return JSONResponse(content={"status": "processing", "message": "CIE Lab Ignition successful."}, status_code=202)
        except Exception as e:
            return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
            
    return web_app
