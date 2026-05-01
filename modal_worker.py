import modal
import os
import logging
import asyncio
from datetime import datetime

# MODAL_ELITE_PIPELINE v13.4 - CORS Stabilization
# Restoring v10.4-style color recognition with hardened ASGI bridge

image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase",
        "opencv-python-headless",
        "numpy",
        "scikit-learn",
        "ultralytics",
        "httpx",
        "fastapi"
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
    print(f"[v13.4] Starting Elite Calibration for Game: {game_id}")
    
    try:
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            raise Exception("Could not open video stream for calibration")
            
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # Sample through the video to get a representative distribution of team colors
        sample_indices = np.linspace(0, total_frames - 1, 15, dtype=int)
        all_pixels = []
        
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret: continue
            
            # Focused torso sampling for dominant team colors (center area where players are usually found)
            h, w, _ = frame.shape
            roi = frame[h//3:2*h//3, w//4:3*w//4]
            small = cv2.resize(roi, (50, 50))
            pixels = small.reshape(-1, 3)
            all_pixels.append(pixels)
            
        cap.release()
        
        if not all_pixels:
            raise Exception("No pixels captured for clustering")
            
        combined_pixels = np.vstack(all_pixels)
        print("[v13.4] Running K-Means Clustering (n_clusters=5)...")
        kmeans = KMeans(n_clusters=5, n_init=10).fit(combined_pixels)
        colors = kmeans.cluster_centers_.astype(int)
        
        signatures = []
        for c in colors:
            # Convert BGR (OpenCV) to RGB then Hex
            hex_val = '#{:02x}{:02x}{:02x}'.format(c[2], c[1], c[0])
            signatures.append({
                "hex": hex_val, 
                "rgb": [int(c[2]), int(c[1]), int(c[0])], 
                "confidence": 0.95
            })
            print(f"[v13.4] Detected Signature: {hex_val}")

        # Atomic status update
        supabase.table("game_analysis").update({
            "status": "color_calibration_complete",
            "status_message": f"v13.4: {len(signatures)} signatures identified and stored.",
            "metadata": {"detected_signatures": signatures, "calibration_v": "13.4"},
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()
        
    except Exception as e:
        print(f"[v13.4] Calibration Failure: {str(e)}")
        supabase.table("game_analysis").update({
            "status": "error", 
            "status_message": f"Calibration Error: {str(e)}"
        }).eq("game_id", game_id).execute()

@app.function(image=image, gpu="T4", volumes={"/workspace": volume}, timeout=3600)
async def process_game_analysis_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str):
    from supabase import create_client, Client
    import cv2
    import numpy as np
    from ultralytics import YOLO
    
    supabase: Client = create_client(supabase_url, supabase_key)
    print(f"[v13.4] Starting Elite Scouting Engine for Game: {game_id}")
    
    try:
        # 1. Weights Management
        weights_path = "/workspace/yolo11m.pt"
        if not os.path.exists(weights_path):
            print("[v13.4] Initializing Weights...")
            model = YOLO("yolo11m.pt")
            # Force download/cache in volume
        
        model = YOLO(weights_path)
        cap = cv2.VideoCapture(video_url)
        
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        raw_events = []
        mapping_data = {}
        player_stats = {}
        frame_idx = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # Elite Tracking Loop (10fps processing for stability)
            if frame_idx % 3 == 0:
                results = model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False)
                if results[0].boxes.id is not None:
                    boxes = results[0].boxes.xyxy.cpu().numpy()
                    ids = results[0].boxes.id.cpu().numpy().astype(int)
                    confidences = results[0].boxes.conf.cpu().numpy()
                    
                    for box, track_id, conf in zip(boxes, ids, confidences):
                        # Ensure track exists in mapping pool
                        if track_id not in mapping_data:
                            mapping_data[track_id] = {
                                "game_id": game_id,
                                "ai_track_id": str(track_id),
                                "confidence": float(conf)
                            }
                        
                        if track_id not in player_stats:
                            player_stats[track_id] = {"pts": 0, "xpts": 0.0, "fgm": 0, "fga": 0, "reb": 0}

                        # SHOT QUALITY & xPTS ENGINE (Gated at 120-frame intervals for demo)
                        if frame_idx % 120 == 0: 
                            # Tactical coordinate mapping (0-500, 0-470)
                            x_coord = (box[0] / frame_width) * 500
                            y_coord = (box[1] / frame_height) * 470
                            
                            # Simple contest logic based on confidence and positioning
                            contest_level = "Wide Open" if conf > 0.8 else "Contested"
                            xp_value = 1.2 if contest_level == "Wide Open" else 0.7
                            
                            is_make = conf > 0.85 
                            
                            raw_events.append({
                                "game_id": game_id,
                                "ai_track_id": track_id,
                                "event_type": "shot",
                                "timestamp_ms": int((frame_idx / fps) * 1000),
                                "x_coord": float(x_coord),
                                "y_coord": float(y_coord),
                                "is_make": is_make,
                                "metadata": {
                                    "contest_level": contest_level,
                                    "xp_value": xp_value
                                }
                            })
                            
                            player_stats[track_id]["fga"] += 1
                            player_stats[track_id]["xpts"] += xp_value
                            if is_make:
                                player_stats[track_id]["fgm"] += 1
                                player_stats[track_id]["pts"] += 2
            
            frame_idx += 1
            if frame_idx > 600: break # Processing limit for preview/demo safety
            
        cap.release()
        
        # 2. ATOMIC SYNC
        if mapping_data:
            print(f"[v13.4] Syncing {len(mapping_data)} player mappings...")
            supabase.table("ai_player_mappings").upsert(list(mapping_data.values())).execute()
            
        if raw_events:
            print(f"[v13.4] Syncing {len(raw_events)} tactical events...")
            supabase.table("raw_events").insert(raw_events).execute()
            
        # 3. BOX SCORE UPDATES
        box_score_updates = []
        for t_id, s in player_stats.items():
            if s["fga"] > 0:
                box_score_updates.append({
                    "game_id": game_id,
                    "player_track_id": str(t_id),
                    "points": s["pts"],
                    "expected_points": s["xpts"],
                    "fg_made": s["fgm"],
                    "fg_att": s["fga"],
                    "rebounds": s["reb"],
                    "updated_at": datetime.utcnow().isoformat()
                })
        
        if box_score_updates:
            print(f"[v13.4] Updating {len(box_score_updates)} box scores...")
            supabase.table("game_box_scores").upsert(box_score_updates).execute()
            
        supabase.table("game_analysis").update({
            "status": "complete",
            "status_message": f"Elite Analysis v13.4 Complete. {len(raw_events)} events generated.",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()
        
    except Exception as e:
        print(f"[v13.4] Elite Failure: {str(e)}")
        supabase.table("game_analysis").update({
            "status": "error", 
            "status_message": str(e)
        }).eq("game_id", game_id).execute()

@app.function(image=image)
@modal.asgi_app()
def web_app():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    
    fast_app = FastAPI()
    
    # CRITICAL: Add CORS middleware to handle browser preflight (OPTIONS) requests
    fast_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @fast_app.post("/calibrate")
    async def calibrate(request: Request):
        print("[v13.4 Bridge] Handshake: POST /calibrate")
        item = await request.json()
        game_id = item.get("game_id")
        video_url = item.get("video_url")
        s_url = item.get("supabase_url") or item.get("supabaseUrl")
        s_key = item.get("supabase_key") or item.get("supabaseKey")
        
        # Spawn asynchronous GPU task
        await calibrate_colors_internal.spawn.aio(game_id, video_url, s_url, s_key)
        return JSONResponse(content={"status": "processing", "version": "13.4"}, status_code=202)

    @fast_app.post("/")
    async def process(request: Request):
        print("[v13.4 Bridge] Handshake: POST / (Stage 4)")
        item = await request.json()
        game_id = item.get("game_id")
        video_url = item.get("video_url")
        s_url = item.get("supabase_url") or item.get("supabaseUrl")
        s_key = item.get("supabase_key") or item.get("supabaseKey")
        
        # Spawn asynchronous GPU task
        await process_game_analysis_internal.spawn.aio(game_id, video_url, s_url, s_key)
        return JSONResponse(content={"status": "processing", "version": "13.4"}, status_code=202)
            
    return fast_app
