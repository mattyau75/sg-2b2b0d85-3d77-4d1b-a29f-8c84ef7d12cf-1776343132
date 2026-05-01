import modal
import os
import logging
import asyncio
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# MODAL_ELITE_PIPELINE v13.8 - CORS Bridge Fix
# Fixed CORS preflight issue for OPTIONS requests

image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase",
        "opencv-python-headless",
        "numpy",
        "scikit-learn",
        "ultralytics",
        "httpx",
        "fastapi[standard]"
    )
)

app = modal.App("basketball-scout-ai-process")
volume = modal.Volume.from_name("scout-weights", create_if_missing=True)

# Create FastAPI app with CORS middleware
fastapi_app = FastAPI()

# Configure CORS to allow all origins (adjust as needed for production)
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.function(image=image, gpu="T4", volumes={"/workspace": volume}, timeout=600)
async def calibrate_colors_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    from supabase import create_client, Client
    import cv2
    import numpy as np
    from sklearn.cluster import KMeans
    
    supabase: Client = create_client(supabase_url, supabase_key)
    print(f"[v13.8] Calibration Started: {game_id}")
    
    try:
        supabase.table("game_analysis").update({
            "status": "analyzing_colors",
            "status_message": "v13.8: Identifying team signatures...",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()

        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            raise Exception("Could not open video stream")
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sample_indices = np.linspace(0, total_frames - 1, 15, dtype=int)
        all_pixels = []
        
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret: continue
            
            h, w, _ = frame.shape
            roi = frame[h//3:2*h//3, w//4:3*w//4]
            small = cv2.resize(roi, (50, 50))
            pixels = small.reshape(-1, 3)
            all_pixels.append(pixels)
        
        cap.release()
        
        if not all_pixels:
            raise Exception("No pixels captured")
        
        combined_pixels = np.vstack(all_pixels)
        kmeans = KMeans(n_clusters=5, n_init=10).fit(combined_pixels)
        colors = kmeans.cluster_centers_.astype(int)
        
        signatures = []
        for c in colors:
            hex_val = '#{:02x}{:02x}{:02x}'.format(c[2], c[1], c[0])
            signatures.append({
                "hex": hex_val, 
                "rgb": [int(c[2]), int(c[1]), int(c[0])], 
                "confidence": 0.95
            })
            print(f"[v13.8] Detected Signature: {hex_val}")

        supabase.table("game_analysis").update({
            "status": "color_calibration_complete",
            "status_message
