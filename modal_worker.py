import modal
import os

# MODAL_ELITE_PIPELINE v6.0 - Modular Basketball Scouting System
# Architecture: Stage 2 (Calibration) → Stage 3 (Inference) → Stage 4 (Reconciliation)

app = modal.App("basketball-scout-ai")
stub = app

# Persistent volume for 24h video caching + YOLO weights
volume = modal.Volume.from_name("basketball-cache", create_if_missing=True)

# Container image with YOLO11m pre-installed
image = (
    modal.Image.from_registry("ultralytics/ultralytics:latest")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "requests",
        "opencv-python-headless",
        "numpy",
        "supabase",
        "boto3"
    )
)

# ============================================================================
# STAGE 2: JERSEY CALIBRATION & TEAM ASSIGNMENT
# ============================================================================
def stage2_calibration(video_url: str, game_id: str):
    """Extract team colors from first 5 minutes of footage"""
    import cv2
    import numpy as np
    import requests
    import base64
    from supabase import create_client
    
    print(f"[STAGE 2] Calibrating colors for game {game_id}")
    
    # Supabase connection
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase = create_client(supabase_url, supabase_key)
    
    # Update processing queue
    supabase.table("processing_queue").upsert({
        "game_id": game_id,
        "stage": "stage2_calibration",
        "status": "in_progress",
        "started_at": "now()"
    }).execute()
    
    try:
        # Roboflow Jersey Detection
        api_key = os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
        model_id = "basketball-jersey-numbers-ocr/2"
        inference_url = f"https://detect.roboflow.com/{model_id}?api_key={api_key}"
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            raise Exception("Video source unreachable")
        
        # Sample first 5 minutes (300 seconds) - every 10 seconds
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        sample_points = [int(fps * s) for s in range(5, 305, 10)]
        
        all_jersey_colors = []
        
        for frame_idx in sample_points:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret: continue
            
            # High-res processing
            h, w = frame.shape[:2]
            target_w = 1280
            target_h = int(h * (target_w / w))
            frame_resized = cv2.resize(frame, (target_w, target_h))
            
            _, buffer = cv2.imencode('.jpg', frame_resized)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            try:
                res = requests.post(
                    f"{inference_url}&confidence=15",
                    data=img_base64,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=4
                )
                preds = res.json().get('predictions', [])
                
                for pred in preds:
                    x, y, pw, ph = pred['x'], pred['y'], pred['width'], pred['height']
                    x1, y1 = int(x - pw/5), int(y - ph/5)
                    x2, y2 = int(x + pw/5), int(y + ph/5)
                    
                    crop = frame_resized[max(0, y1):min(target_h, y2), max(0, x1):min(target_w, x2)]
                    if crop.size < 15: continue
                    
                    pixels = crop.reshape(-1, 3).astype(np.float32)
                    _, _, centers = cv2.kmeans(pixels, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 5, 1.0), 5, cv2.KMEANS_PP_CENTERS)
                    
                    for center in centers:
                        b, g, r = center
                        saturation = max(r, g, b) - min(r, g, b)
                        is_court = (r > 130 and g > 100 and abs(r-g) < 45 and saturation < 65)
                        if not is_court:
                            all_jersey_colors.append([r, g, b])
            except:
                continue
            
            if len(all_jersey_colors) >= 30:
                break
        
        cap.release()
        
        if len(all_jersey_colors) < 2:
            raise Exception("Insufficient jersey samples detected")
        
        # K-Means clustering into 2 teams
        _, _, final_centers = cv2.kmeans(
            np.array(all_jersey_colors, dtype=np.float32), 
            2, 
            None, 
            (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 
            10, 
            cv2.KMEANS_PP_CENTERS
        )
        
        sorted_centers = sorted(final_centers.tolist(), key=lambda c: sum(c), reverse=True)
        
        home_hex = f"#{int(sorted_centers[0][0]):02x}{int(sorted_centers[0][1]):02x}{int(sorted_centers[0][2]):02x}"
        away_hex = f"#{int(sorted_centers[1][0]):02x}{int(sorted_centers[1][1]):02x}{int(sorted_centers[1][2]):02x}"
        
        # Write to game_config
        supabase.table("game_config").upsert({
            "game_id": game_id,
            "home_color_hex": home_hex,
            "away_color_hex": away_hex,
            "home_color_samples": [c for c in all_jersey_colors if np.linalg.norm(np.array(c) - sorted_centers[0]) < 50],
            "away_color_samples": [c for c in all_jersey_colors if np.linalg.norm(np.array(c) - sorted_centers[1]) < 50],
            "calibration_method": "auto"
        }).execute()
        
        # Mark stage as completed
        supabase.table("processing_queue").update({
            "status": "completed",
            "completed_at": "now()",
            "metadata": {"home_color": home_hex, "away_color": away_hex}
        }).eq("game_id", game_id).eq("stage", "stage2_calibration").execute()
        
        print(f"[STAGE 2] Complete: {home_hex} (Home), {away_hex} (Away)")
        return {
            "status": "success", 
            "colors": {
                "home": home_hex, 
                "away": away_hex
            }
        }
        
    except Exception as e:
        supabase.table("processing_queue").update({
            "status": "failed",
            "completed_at": "now()",
            "error_message": str(e)
        }).eq("game_id", game_id).eq("stage", "stage2_calibration").execute()
        return {"status": "error", "message": str(e)}


# ============================================================================
# STAGE 3: RAW DATA GENERATION (INFERENCE ENGINE)
# ============================================================================
def stage3_inference(video_url: str, game_id: str):
    """Multi-model inference with YOLO11m + Roboflow + ByteTrack"""
    import cv2
    import numpy as np
    from ultralytics import YOLO
    from supabase import create_client
    import boto3
    import requests
    import base64
    from datetime import datetime
    
    print(f"[STAGE 3] Starting inference for game {game_id}")
    
    # Supabase connection
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase = create_client(supabase_url, supabase_key)
    
    # R2 for ghost snapshots
    r2 = boto3.client(
        's3',
        endpoint_url=os.environ.get("R2_ENDPOINT"),
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY")
    )
    bucket_name = os.environ.get("R2_BUCKET_NAME", "basketball-scouting")
    
    # Roboflow Jersey Detection
    api_key = os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
    model_id = "basketball-jersey-numbers-ocr/2"
    inference_url = f"https://detect.roboflow.com/{model_id}?api_key={api_key}"
    
    # Update processing queue
    supabase.table("processing_queue").upsert({
        "game_id": game_id,
        "stage": "stage3_inference",
        "status": "in_progress",
        "started_at": "now()"
    }).execute()
    
    try:
        # Load YOLO11m from persistent volume (download if not cached)
        model_path = "/data/yolo11m.pt"
        try:
            model = YOLO(model_path)
        except:
            print("[STAGE 3] Downloading YOLO11m to persistent volume...")
            model = YOLO("yolo11m.pt")
            model.save(model_path)
        
        # Get game config for color matching
        config = supabase.table("game_config").select("*").eq("game_id", game_id).single().execute()
        if not config.data:
            raise Exception("Game config not found - run Stage 2 first")
        
        home_color = np.array([int(config.data["home_color_hex"][i:i+2], 16) for i in (1, 3, 5)])
        away_color = np.array([int(config.data["away_color_hex"][i:i+2], 16) for i in (1, 3, 5)])
        
        # Process video
        cap = cv2.VideoCapture(video_url)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        frame_number = 0
        player_tracks = {}  # Track player IDs across frames
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            frame_number += 1
            timestamp_ms = int((frame_number / fps) * 1000)
            
            # YOLO detection (Person, Ball, Hoop)
            results = model.track(frame, classes=[0, 32, 37], conf=0.25, imgsz=1280, persist=True, verbose=False)
            
            # Process each detection
            for r in results:
                boxes = r.boxes
                if boxes is None: continue
                
                for i, box in enumerate(boxes):
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    track_id = int(box.id[0]) if box.id is not None else None
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    
                    # PERSON DETECTION
                    if cls == 0:
                        # Extract torso for jersey detection
                        h = y2 - y1
                        torso_y1 = int(y1 + h * 0.2)
                        torso_y2 = int(y1 + h * 0.6)
                        torso_crop = frame[torso_y1:torso_y2, int(x1):int(x2)]
                        
                        if torso_crop.size < 100: continue
                        
                        # Jersey number detection via Roboflow
                        _, buffer = cv2.imencode('.jpg', torso_crop)
                        img_base64 = base64.b64encode(buffer).decode('utf-8')
                        
                        jersey_number = None
                        jersey_confidence = 0.0
                        team_assignment = None
                        
                        try:
                            res = requests.post(
                                f"{inference_url}&confidence=50",
                                data=img_base64,
                                headers={"Content-Type": "application/x-www-form-urlencoded"},
                                timeout=3
                            )
                            preds = res.json().get('predictions', [])
                            if preds:
                                best_pred = max(preds, key=lambda p: p['confidence'])
                                jersey_number = best_pred.get('class', '').replace('J', '')
                                jersey_confidence = best_pred['confidence'] / 100
                        except:
                            pass
                        
                        # Team assignment via color matching
                        pixels = torso_crop.reshape(-1, 3).astype(np.float32)
                        _, _, centers = cv2.kmeans(pixels, 1, None, (cv2.TERM_CRITERIA_EPS, 5, 1.0), 3, cv2.KMEANS_PP_CENTERS)
                        dominant_color = centers[0][::-1]  # BGR to RGB
                        
                        home_dist = np.linalg.norm(dominant_color - home_color)
                        away_dist = np.linalg.norm(dominant_color - away_color)
                        team_assignment = "home" if home_dist < away_dist else "away"
                        
                        # GHOST SNAPSHOT SYSTEM
                        if jersey_confidence < 0.80:
                            # Create 128x128 snapshot
                            snapshot = cv2.resize(torso_crop, (128, 128))
                            _, snapshot_buffer = cv2.imencode('.jpg', snapshot)
                            
                            ghost_id = f"ghost_{game_id}_{timestamp_ms}_{track_id or i}"
                            snapshot_key = f"ghosts/{game_id}/{ghost_id}.jpg"
                            
                            # Upload to R2
                            r2.put_object(
                                Bucket=bucket_name,
                                Key=snapshot_key,
                                Body=snapshot_buffer.tobytes(),
                                ContentType='image/jpeg'
                            )
                            
                            # Record in database
                            supabase.table("ghost_players").insert({
                                "game_id": game_id,
                                "ghost_id": ghost_id,
                                "snapshot_url": f"https://pub-{bucket_name}.r2.dev/{snapshot_key}",
                                "timestamp_ms": timestamp_ms,
                                "team": team_assignment,
                                "detected_number": jersey_number if jersey_confidence > 0.3 else None,
                                "confidence": jersey_confidence,
                                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                                "track_id": track_id
                            }).execute()
                        
                        # Track player state
                        if track_id:
                            player_tracks[track_id] = {
                                "jersey": jersey_number,
                                "team": team_assignment,
                                "last_pos": [(x1+x2)/2, (y1+y2)/2],
                                "last_seen": timestamp_ms
                            }
                    
                    # BALL DETECTION
                    elif cls == 32:
                        ball_pos = [(x1+x2)/2, (y1+y2)/2]
                        
                        # Find nearest player
                        nearest_player = None
                        min_dist = float('inf')
                        for pid, pdata in player_tracks.items():
                            dist = np.linalg.norm(np.array(ball_pos) - np.array(pdata["last_pos"]))
                            if dist < min_dist and (timestamp_ms - pdata["last_seen"]) < 1000:
                                min_dist = dist
                                nearest_player = pid
                        
                        if nearest_player and min_dist < 200:
                            # Record possession event
                            supabase.table("raw_events").insert({
                                "game_id": game_id,
                                "timestamp_ms": timestamp_ms,
                                "event_type": "possession",
                                "player_track_id": nearest_player,
                                "jersey_number": player_tracks[nearest_player]["jersey"],
                                "team": player_tracks[nearest_player]["team"],
                                "ball_position": ball_pos
                            }).execute()
            
            # Progress update every 100 frames
            if frame_number % 100 == 0:
                supabase.table("processing_queue").update({
                    "metadata": {"frames_processed": frame_number, "progress_pct": int((frame_number / cap.get(cv2.CAP_PROP_FRAME_COUNT)) * 100)}
                }).eq("game_id", game_id).eq("stage", "stage3_inference").execute()
        
        cap.release()
        
        # Mark complete
        supabase.table("processing_queue").update({
            "status": "completed",
            "completed_at": "now()",
            "metadata": {"frames_processed": frame_number}
        }).eq("game_id", game_id).eq("stage", "stage3_inference").execute()
        
        print(f"[STAGE 3] Complete: {frame_number} frames processed")
        return {"status": "success", "frames_processed": frame_number}
        
    except Exception as e:
        supabase.table("processing_queue").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("game_id", game_id).eq("stage", "stage3_inference").execute()
        return {"status": "error", "message": str(e)}


# ============================================================================
# FASTAPI ENDPOINT (Multi-Mode)
# ============================================================================
@app.function(
    image=image, 
    gpu="A10G", 
    timeout=3600,
    volumes={"/data": volume}
)
@modal.asgi_app()
def process():
    """Main entry point for the modular basketball pipeline"""
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    @web_app.post("/")
    async def endpoint(request: Request):
        data = await request.json()
        mode = data.get("pipeline_mode")
        
        if mode == "ping":
            return JSONResponse(content={"status": "warm"})
        
        if mode == "stage2_calibration":
            result = stage2_calibration(data.get("video_url"), data.get("game_id"))
            return JSONResponse(content=result)
        
        if mode == "stage3_inference":
            result = stage3_inference(data.get("video_url"), data.get("game_id"))
            return JSONResponse(content=result)
        
        return JSONResponse(content={"status": "error", "message": "Invalid mode"}, status_code=400)
    
    return web_app
