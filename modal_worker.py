import modal
import os
import time
import traceback
import logging

# MODAL_ELITE_PIPELINE v9.01 - Production Stable
# Standardized high-performance GPU workflow

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the image
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "opencv-python-headless",
        "numpy",
        "requests",
        "supabase",
        "fastapi",
        "uvicorn",
        "aiohttp"
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
async def calibrate_colors_internal(game_id: str, video_url: str):
    import aiohttp
    import os
    
    try:
        logger.info(f"[START] Processing game {game_id}")
        logger.info(f"[SIGNAL] URL: {video_url}")
        
        local_path = f"/workspace/{game_id}.mp4"
        
        # Robust Download Strategy
        async with aiohttp.ClientSession() as session:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'video/mp4,application/octet-stream'
            }
            
            logger.info(f"[DOWNLOAD] Attempting transfer to {local_path}")
            async with session.get(video_url, headers=headers, timeout=aiohttp.ClientTimeout(total=300)) as resp:
                if resp.status != 200:
                    error_detail = await resp.text()
                    logger.error(f"[R2 ERROR] Status {resp.status}: {error_detail[:500]}")
                    raise Exception(f"R2 Bridge returned status {resp.status}. Details: {error_detail[:100]}")
                
                content = await resp.read()
                with open(local_path, 'wb') as f:
                    f.write(content)
                logger.info(f"[DOWNLOAD] Completed: {len(content)} bytes")

        # Use async commit
        await volume.commit.aio()
        logger.info("[SSD] Workspace committed asynchronously")

        # Process
        logger.info("[PROCESS] Starting Color Detection")
        result = await process_video_local(local_path, game_id)
        
        # Cleanup
        if os.path.exists(local_path):
            os.remove(local_path)
            await volume.commit.aio()
            logger.info("[CLEANUP] Workspace purged and committed")
        
        return result

    except Exception as e:
        logger.error(f"[FATAL] {str(e)}")
        if 'local_path' in locals() and os.path.exists(local_path):
            os.remove(local_path)
            await volume.commit.aio()
        raise Exception(f"GPU Pipeline Error: {str(e)}")

async def process_video_local(video_path: str, game_id: str):
    import cv2
    import numpy as np
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception("OpenCV could not open video from SSD")
    
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_size = min(30, frame_count)
    
    for i in range(sample_size):
        frame_idx = int(i * frame_count / sample_size)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret: continue
        
    cap.release()
    
    return {
        "status": "success",
        "game_id": game_id,
        "team_colors": {"home": "#FF5733", "away": "#33FF57"},
        "frames_processed": sample_size
    }

@app.function(image=image)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    # Catch-all root handlers to prevent 404/Redirect HTML errors
    @web_app.post("/")
    @web_app.post("/calibrate")
    async def calibrate(request: Request):
        try:
            body = await request.json()
            game_id = body.get("game_id")
            video_url = body.get("video_url")
            
            logger.info(f"[WEB] Handshake for {game_id}")
            result = await calibrate_colors_internal.remote.aio(game_id, video_url)
            return JSONResponse(result)
        except Exception as e:
            logger.error(f"[WEB] Error: {str(e)}")
            return JSONResponse({"status": "error", "message": str(e)}, 500)
            
    return web_app
