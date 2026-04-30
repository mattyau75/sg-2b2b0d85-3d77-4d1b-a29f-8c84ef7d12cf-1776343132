import modal
import os
import logging
import asyncio

# MODAL_ELITE_PIPELINE v9.07 - Fire-and-Forget Architecture
# Targeted ROI extraction with autonomous Supabase reporting

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
    
    local_path = f"/workspace/{game_id}.mp4"
    supabase: Client = create_client(supabase_url, supabase_key)
    
    try:
        logger.info(f"[START] Deep Pixel Scan: {game_id}")
        
        # 1. STREAM DOWNLOAD
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url, timeout=aiohttp.ClientTimeout(total=600)) as resp:
                if resp.status not in [200, 206]:
                    raise Exception(f"R2 Bridge Error: {resp.status}")
                
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        await volume.commit.aio()

        # 2. VISION ENGINE: ROI PLAYER TARGETING
        cap = cv2.VideoCapture(local_path)
        if not cap.isOpened(): raise Exception("Codec Error")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # Sample 15 frames from the first 5 minutes (ignoring intros)
        sample_indices = np.linspace(min(1000, frame_count // 2), min(9000, frame_count - 1), 15).astype(int)
        
        all_pixels = []
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret: continue
            
            # ROI: Focus on center-court belt (Player Zone)
            h, w = frame.shape[:2]
            # Focus on the action area to avoid crowd/floor
            roi = frame[int(h*0.25):int(h*0.75), int(w*0.15):int(w*0.85)]
            small = cv2.resize(roi, (100, 100))
            all_pixels.append(small.reshape(-1, 3))

        cap.release()
        
        if not all_pixels: raise Exception("Vision: Zero pixels captured")

        pixel_stack = np.vstack(all_pixels)
        
        # 3. K-MEANS: Extract 10 clusters (higher fidelity)
        kmeans = KMeans(n_clusters=10, n_init=5)
        kmeans.fit(pixel_stack)
        centers = kmeans.cluster_centers_
        
        def bgr_to_hex(bgr):
            return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))

        # 4. ELITE JERSEY FILTERING
        # Reject colors that look like court (wood/tan) or shadows
        processed = []
        for center in centers:
            r, g, b = center[2], center[1], center[0]
            # Reject Basketball Court (Wood tones)
            is_court = (r > 140 and g > 110 and b < 130 and r > b + 20)
            # Reject Neutral Gray (Shadows/Floor)
            is_neutral = (max(r,g,b) - min(r,g,b)) < 20
            
            if not is_court and not is_neutral:
                processed.append(center)

        # Result Logic: Home = Lightest, Away = Darkest of valid jersey clusters
        if len(processed) < 2:
            # Fallback to extreme luminosity if filtering was too aggressive
            luminosities = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in centers]
            sorted_idx = np.argsort(luminosities)
            away_hex = bgr_to_hex(centers[sorted_idx[0]])
            home_hex = bgr_to_hex(centers[sorted_idx[-1]])
        else:
            luminosities = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in processed]
            sorted_idx = np.argsort(luminosities)
            away_hex = bgr_to_hex(processed[sorted_idx[0]])
            home_hex = bgr_to_hex(processed[sorted_idx[-1]])
        
        # 5. AUTONOMOUS REPORTING
        # Update game_config directly from GPU
        supabase.table("game_config").upsert({
            "game_id": game_id,
            "home_color_hex": home_hex,
            "away_color_hex": away_hex,
            "updated_at": "now()"
        }, on_conflict="game_id").execute()

        # Update analysis status
        supabase.table("game_analysis").update({
            "status": "calibration_ready",
            "metadata": {"colors": {"home": home_hex, "away": away_hex}}
        }).eq("game_id", game_id).execute()

        logger.info(f"[SUCCESS] Signatures Locked: {home_hex} / {away_hex}")
        
        if os.path.exists(local_path):
            os.remove(local_path)
            await volume.commit.aio()

    except Exception as e:
        logger.exception("[FATAL] GPU Crash")
        supabase.table("game_analysis").update({
            "status": "error",
            "status_message": f"GPU Error: {str(e)}"
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
            
            if not game_id or not video_url:
                return JSONResponse({"status": "error", "message": "Params missing"}, 400)
            
            # TRIGGER AND DISCONNECT: Fire-and-Forget
            background_tasks.add_task(
                calibrate_colors_internal.remote.aio, 
                game_id, 
                video_url, 
                supabase_url, 
                supabase_key
            )
            
            return JSONResponse({"status": "processing", "message": "GPU worker ignited in background."})
        except Exception as e:
            return JSONResponse({"status": "error", "message": str(e)}, 500)
            
    return web_app
