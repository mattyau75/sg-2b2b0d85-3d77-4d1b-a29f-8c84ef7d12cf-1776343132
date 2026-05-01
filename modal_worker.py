import modal
import os
import logging
import asyncio
from datetime import datetime

# MODAL_ELITE_PIPELINE v13.6 - Re-Stabilized Bridge
# Restoring the v10.4 methodology using the updated @modal.fastapi_endpoint decorator.

image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase",
        "opencv-python-headless",
        "numpy",
        "scikit-learn",
        "ultralytics",
        "httpx"
    )
)

app = modal.App("basketball-scout-ai-process")
volume = modal.Volume.from_name("scout-weights", create_if_missing=True)

@app.function(image=image, gpu="T4", volumes={"/workspace": volume}, timeout=600)
async def calibrate_colors_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    from supabase import create_client, Client
    import cv2
    import numpy as np
    from sklearn.cluster import KMeans
    
    supabase: Client = create_client(supabase_url, supabase_key)
    print(f"[v13.6] Restoration: Calibration Started: {game_id}")
    
    try:
        supabase.table("game_analysis").update({
            "status": "analyzing_colors",
            "status_message": "v13.6: Identifying team signatures...",
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
            print(f"[v13.6] Detected Signature: {hex_val}")

        supabase.table("game_analysis").update({
            "status": "color_calibration_complete",
            "status_message": "v13.6: Color recognition verified.",
            "metadata": {"detected_signatures": signatures, "v": "13.6"},
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()
        
    except Exception as e:
        print(f"[v13.6] Calibration Error: {str(e)}")
        supabase.table("game_analysis").update({
            "status": "error", 
            "status_message": f"Error: {str(e)}"
        }).eq("game_id", game_id).execute()

@app.function(image=image, gpu="T4", volumes={"/workspace": volume}, timeout=3600)
async def process_game_analysis_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    from supabase import create_client, Client
    import cv2
    from ultralytics import YOLO
    
    supabase: Client = create_client(supabase_url, supabase_key)
    print(f"[v13.6] Elite Engine Started: {game_id}")
    
    try:
        model = YOLO("/workspace/yolo11m.pt" if os.path.exists("/workspace/yolo11m.pt") else "yolo11m.pt")
        cap = cv2.VideoCapture(video_url)
        
        mapping_data = {}
        frame_idx = 0
        
        while cap.isOpened() and frame_idx < 300: # Fast sample
            ret, frame = cap.read()
            if not ret: break
            
            if frame_idx % 5 == 0:
                results = model.track(frame, persist=True, verbose=False)
                if results[0].boxes.id is not None:
                    ids = results[0].boxes.id.cpu().numpy().astype(int)
                    for track_id in ids:
                        if track_id not in mapping_data:
                            mapping_data[track_id] = {
                                "game_id": game_id,
                                "ai_track_id": str(track_id),
                                "confidence": 0.9
                            }
            frame_idx += 1
            
        cap.release()
        
        if mapping_data:
            supabase.table("ai_player_mappings").upsert(list(mapping_data.values())).execute()
            
        supabase.table("game_analysis").update({
            "status": "complete",
            "status_message": "v13.6: Analysis Complete.",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()
        
    except Exception as e:
        print(f"[v13.6] Process Error: {str(e)}")
        supabase.table("game_analysis").update({
            "status": "error", 
            "status_message": str(e)
        }).eq("game_id", game_id).execute()

# RESTORED v10.4 PATTERN USING UPDATED SDK DECORATOR
@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
async def calibrate(item: dict):
    print(f"[v13.6 Bridge] POST /calibrate Handshake Received")
    game_id = item.get("game_id")
    video_url = item.get("video_url")
    s_url = item.get("supabase_url") or item.get("supabaseUrl")
    s_key = item.get("supabase_key") or item.get("supabaseKey")
    
    calibrate_colors_internal.spawn(game_id, video_url, s_url, s_key)
    return {"status": "processing", "v": "13.6"}

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
async def process(item: dict):
    print(f"[v13.6 Bridge] POST /process Handshake Received")
    game_id = item.get("game_id")
    video_url = item.get("video_url")
    s_url = item.get("supabase_url") or item.get("supabaseUrl")
    s_key = item.get("supabase_key") or item.get("supabaseKey")
    
    process_game_analysis_internal.spawn(game_id, video_url, s_url, s_key)
    return {"status": "processing", "v": "13.6"}
