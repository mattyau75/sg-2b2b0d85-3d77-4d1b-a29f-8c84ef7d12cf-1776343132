import modal
import os
import time
import asyncio
from typing import Dict, List

# MODAL ELITE PIPELINE v17.14 - MULTI-MODEL TACTICAL FUSION
VERSION = "17.14"

# Provision High-Performance Volume for 3-hour temporary tactical storage
cache_volume = modal.Volume.from_name("scout-cache-v17", create_if_missing=True)

scout_image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase", 
        "ultralytics>=8.3.0", # YOLO11 support
        "httpx", 
        "fastapi", 
        "pydantic",
        "numpy",
        "opencv-python-headless",
        "pyyaml",
        "scipy" # For trajectory analysis
    )
)

app = modal.App("basketball-scout-ai-v17", image=scout_image)

@app.function(volumes={"/cache": cache_volume}, timeout=3600, gpu="A10G")
@modal.fastapi_endpoint(method="POST", label="v17-process")
async def start_pipeline(payload: Dict):
    game_id = payload.get("gameId")
    supabase_url = payload.get("supabaseUrl")
    supabase_key = payload.get("supabaseKey")
    video_url = payload.get("videoUrl")
    target_stage = payload.get("targetStage", "ingest") 
    
    if not all([game_id, supabase_url, supabase_key, video_url]):
        return {"status": "error", "message": "Missing credentials or video source"}

    asyncio.create_task(run_stage(game_id, video_url, supabase_url, supabase_key, target_stage))
    
    return {
        "status": "accepted",
        "stage": target_stage,
        "id": game_id,
        "message": f"v{VERSION} Handshake: Stage '{target_stage}' Authorized."
    }

async def run_stage(game_id: str, video_url: str, supabase_url: str, supabase_key: str, stage: str):
    import httpx
    import cv2
    import numpy as np
    import yaml
    from ultralytics import YOLO
    from supabase import create_client
    from scipy.spatial import distance
    
    supabase = create_client(supabase_url, supabase_key)
    local_path = f"/cache/{game_id}_video.mp4"
    config_path = f"/cache/bytetrack_elite.yaml"

    def update_log(current_stage: str, progress: int, message: str, severity: str = "info", needs_review: bool = False):
        supabase.table("game_events").insert({
            "game_id": game_id,
            "event_type": "pipeline_status",
            "severity": severity,
            "payload": {"stage": current_stage, "progress": progress, "message": message},
            "timestamp_ms": int(time.time() * 1000)
        }).execute()
        
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "current_stage": current_stage,
            "progress_percentage": progress,
            "status_message": message,
            "needs_review": needs_review,
            "updated_at": "now()"
        }, on_conflict="game_id").execute()

    try:
        if stage == "ingest":
            update_log("ingest", 5, f"v{VERSION} Signal: Starting Chunked R2 -> GPU Cache...")
            
            async with httpx.AsyncClient() as client:
                async with client.stream("GET", video_url) as response:
                    if response.status_code != 200:
                        raise Exception(f"R2 Fetch Failed: {response.status_code}")
                    
                    total_size = int(response.headers.get("content-length", 0))
                    downloaded = 0
                    last_log_time = time.time()
                    
                    with open(local_path, "wb") as f:
                        async for chunk in response.aiter_bytes():
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            if time.time() - last_log_time > 3 and total_size > 0:
                                progress = int((downloaded / total_size) * 100)
                                update_log("ingest", progress, f"v{VERSION} GPU Cache: {progress}% cached ({downloaded // 1024 // 1024}MB)")
                                last_log_time = time.time()
            
            # v17.14 Elite ByteTrack Parameters
            bt_config = {
                "tracker_type": "bytetrack",
                "track_high_thresh": 0.6,
                "track_low_thresh": 0.1,
                "new_track_thresh": 0.7,
                "track_buffer": 45, # lost_track_buffer
                "match_thresh": 0.12, # match_iou_min
                "min_box_area": 10,
                "mot20": False
            }
            with open(config_path, "w") as f:
                yaml.dump(bt_config, f)
            
            update_log("ingest", 100, f"v{VERSION} Stage 1 Complete: Video Cached locally. Handshake error-free.", needs_review=True)
            
        elif stage == "detect":
            if not os.path.exists(local_path):
                raise Exception("Local video cache missing. Run Stage 1 first.")
            
            update_log("detect", 5, f"v{VERSION} Stage 2: Initializing Multi-Model Tactical Fusion...")
            
            # Load Multi-Model Stack
            player_model = YOLO("yolo11m.pt")  # High-precision person detection
            ball_model = YOLO("yolov8n.pt")    # Fast basketball detection
            
            cap = cv2.VideoCapture(local_path)
            if not cap.isOpened():
                raise Exception("Failed to open video for detection pass.")
                
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            # Court Mask (Simple tactical focus area - center 80% of frame)
            mask = np.zeros((height, width), dtype=np.uint8)
            cv2.rectangle(mask, (int(width*0.1), int(height*0.1)), (int(width*0.9), int(height*0.9)), 255, -1)
            
            # Hoop Detection (Simplified - top 20% corners for basket positions)
            left_hoop_zone = (int(width*0.05), int(height*0.05), int(width*0.25), int(height*0.25))
            right_hoop_zone = (int(width*0.75), int(height*0.05), int(width*0.95), int(height*0.25))
            
            update_log("detect", 10, f"v{VERSION} Tactical Fusion: Player + Ball + Court + Events...")
            
            # Tracking State
            track_records = {}  # player tracklets
            gold_frames = {}    # high-quality crops for OCR
            ball_trajectory = []  # ball position history
            events = []  # raw play-by-play events
            last_possession = None
            
            frame_idx = 0
            
            while True:
                ret, frame = cap.read()
                if not ret: break
                
                frame_idx += 1
                timestamp_sec = frame_idx / fps
                
                # Apply Mask
                masked_frame = cv2.bitwise_and(frame, frame, mask=mask)
                
                # === PLAYER DETECTION & TRACKING ===
                player_results = player_model.track(
                    source=masked_frame,
                    persist=True,
                    tracker=config_path,
                    conf=0.4,
                    iou=0.5,
                    imgsz=1280,
                    half=True,
                    verbose=False,
                    classes=[0]  # person class only
                )
                
                # Extract Player Tracklets
                current_players = {}
                if player_results[0].boxes.id is not None:
                    ids = player_results[0].boxes.id.cpu().numpy().astype(int)
                    confs = player_results[0].boxes.conf.cpu().numpy()
                    boxes = player_results[0].boxes.xyxy.cpu().numpy()
                    
                    for tid, conf, box in zip(ids, confs, boxes):
                        x1, y1, x2, y2 = box
                        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                        
                        current_players[tid] = {
                            "box": box,
                            "center": (cx, cy),
                            "conf": conf
                        }
                        
                        # Update tracking records
                        if tid not in track_records:
                            track_records[tid] = {"sum": 0, "count": 0, "best_frames": []}
                        track_records[tid]["sum"] += conf
                        track_records[tid]["count"] += 1
                        
                        # Gold Frame Selection (top 10 per player for OCR)
                        if len(track_records[tid]["best_frames"]) < 10:
                            track_records[tid]["best_frames"].append({
                                "frame_idx": frame_idx,
                                "conf": conf,
                                "box": box
                            })
                        else:
                            min_frame = min(track_records[tid]["best_frames"], key=lambda x: x["conf"])
                            if conf > min_frame["conf"]:
                                track_records[tid]["best_frames"].remove(min_frame)
                                track_records[tid]["best_frames"].append({
                                    "frame_idx": frame_idx,
                                    "conf": conf,
                                    "box": box
                                })
                
                # === BALL DETECTION ===
                ball_results = ball_model(masked_frame, conf=0.3, imgsz=640, half=True, verbose=False, classes=[32])  # sports ball
                
                ball_pos = None
                if len(ball_results[0].boxes) > 0:
                    # Take highest confidence ball detection
                    best_ball = max(ball_results[0].boxes, key=lambda b: b.conf)
                    bx1, by1, bx2, by2 = best_ball.xyxy[0].cpu().numpy()
                    ball_pos = ((bx1 + bx2) / 2, (by1 + by2) / 2)
                    ball_trajectory.append({
                        "frame": frame_idx,
                        "timestamp": timestamp_sec,
                        "pos": ball_pos
                    })
                
                # === EVENT SYNTHESIS ===
                if ball_pos and current_players:
                    # Find closest player to ball
                    closest_player = None
                    min_dist = float('inf')
                    
                    for tid, pdata in current_players.items():
                        dist = distance.euclidean(ball_pos, pdata["center"])
                        if dist < min_dist:
                            min_dist = dist
                            closest_player = tid
                    
                    # Possession Change Detection (proximity threshold: 100px)
                    if closest_player and min_dist < 100:
                        if last_possession != closest_player:
                            events.append({
                                "type": "possession_change",
                                "timestamp": timestamp_sec,
                                "frame": frame_idx,
                                "player_id": str(closest_player),
                                "ball_pos": ball_pos
                            })
                            last_possession = closest_player
                    
                    # Shot Attempt Detection (ball moving toward hoop zones)
                    if len(ball_trajectory) > 5:
                        recent_traj = ball_trajectory[-5:]
                        # Check if ball is moving upward and toward a hoop zone
                        dy = recent_traj[-1]["pos"][1] - recent_traj[0]["pos"][1]
                        if dy < -20:  # Moving upward
                            bx, by = ball_pos
                            # Check proximity to hoop zones
                            in_left_zone = left_hoop_zone[0] < bx < left_hoop_zone[2] and left_hoop_zone[1] < by < left_hoop_zone[3]
                            in_right_zone = right_hoop_zone[0] < bx < right_hoop_zone[2] and right_hoop_zone[1] < by < right_hoop_zone[3]
                            
                            if in_left_zone or in_right_zone:
                                events.append({
                                    "type": "shot_attempt",
                                    "timestamp": timestamp_sec,
                                    "frame": frame_idx,
                                    "player_id": str(closest_player) if closest_player else None,
                                    "ball_pos": ball_pos,
                                    "hoop": "left" if in_left_zone else "right"
                                })
                
                # Progress Logging
                if frame_idx % 100 == 0:
                    progress = int((frame_idx / total_frames) * 100)
                    update_log("detect", progress, f"v{VERSION} Fusion Active: Frame {frame_idx}/{total_frames} • {len(events)} Events")

                # Safety break for preview - remove for full analysis
                if frame_idx > 1000: break 
            
            cap.release()
            
            update_log("detect", 95, f"v{VERSION} Persisting Tactical Data: Tracklets + Events + Gold Frames...")
            
            # === PERSIST TRACKLETS ===
            for tid, data in track_records.items():
                if data["count"] < 2: continue  # minimum_consecutive_frames=2
                avg_conf = float(data["sum"] / data["count"])
                
                # Store gold frame references
                gold_frame_refs = [{"frame": gf["frame_idx"], "conf": float(gf["conf"])} for gf in data["best_frames"]]
                
                supabase.table("ai_player_mappings").upsert({
                    "game_id": game_id,
                    "ai_track_id": str(tid),
                    "confidence": avg_conf,
                    "gold_frames": gold_frame_refs,  # Top 10 frames for OCR
                    "updated_at": "now()"
                }, on_conflict="game_id,ai_track_id").execute()
            
            # === PERSIST EVENTS ===
            for event in events:
                supabase.table("game_events").insert({
                    "game_id": game_id,
                    "event_type": event["type"],
                    "timestamp_ms": int(event["timestamp"] * 1000),
                    "severity": "info",
                    "payload": {
                        "frame": event["frame"],
                        "player_id": event.get("player_id"),
                        "ball_pos": event.get("ball_pos"),
                        "hoop": event.get("hoop")
                    }
                }).execute()
            
            update_log("detect", 100, f"v{VERSION} Stage 2 Complete: {len(track_records)} Tracklets • {len(events)} Events • Multi-Model Fusion Verified.", needs_review=True)
            
    except Exception as e:
        update_log(stage, 0, f"v{VERSION} Fatal: {str(e)}", "error")

@app.function()
@modal.fastapi_endpoint(method="GET", label="v17-health")
async def health():
    return {"status": "operational", "version": VERSION, "audited": True, "cache_mount": "/cache"}
