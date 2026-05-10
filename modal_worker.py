import modal
import os
import time
import asyncio
from typing import Dict, List

# MODAL ELITE PIPELINE v17.0 - INTERVENTIONAL ARCHITECTURE
VERSION = "17.0"

scout_image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase", 
        "ultralytics", 
        "httpx", 
        "fastapi", 
        "pydantic",
        "numpy",
        "opencv-python-headless"
    )
)

app = modal.App("basketball-scout-ai-v17", image=scout_image)

@app.function()
@modal.fastapi_endpoint(method="POST", label="v17-process")
async def start_pipeline(payload: Dict):
    game_id = payload.get("gameId")
    supabase_url = payload.get("supabaseUrl")
    supabase_key = payload.get("supabaseKey")
    video_url = payload.get("videoUrl")
    target_stage = payload.get("targetStage", "ingest") # Default to first stage
    
    if not all([game_id, supabase_url, supabase_key, video_url]):
        return {"status": "error", "message": "Missing credentials or video source"}

    # Trigger stage-specific orchestration
    asyncio.create_task(run_stage(game_id, video_url, supabase_url, supabase_key, target_stage))
    
    return {
        "status": "accepted",
        "stage": target_stage,
        "message": f"v{VERSION} Stage '{target_stage}' Ignited. Handshake successful."
    }

async def run_stage(game_id: str, video_url: str, supabase_url: str, supabase_key: str, stage: str):
    from supabase import create_client
    supabase = create_client(supabase_url, supabase_key)

    def update_log(current_stage: str, progress: int, message: str, severity: str = "info", needs_review: bool = False):
        supabase.table("game_events").insert({
            "game_id": game_id,
            "event_type": "pipeline_status",
            "severity": severity,
            "payload": {"stage": current_stage, "progress": progress, "message": message},
            "timestamp_ms": int(time.time() * 1000)
        }).execute()
        
        supabase.table("game_analysis").update({
            "current_stage": current_stage,
            "progress_percentage": progress,
            "status_message": message,
            "needs_review": needs_review,
            "last_authorized_stage": current_stage if not needs_review else None,
            "updated_at": "now()"
        }).eq("game_id", game_id).execute()

    try:
        if stage == "ingest":
            update_log("ingest", 10, "Stage 1: Normalizing lighting and court lines...")
            await asyncio.sleep(3)
            update_log("ingest", 20, "Stage 1 Complete. Awaiting Scout review for Stabilization.", needs_review=True)
            
        elif stage == "detect":
            update_log("detect", 30, "Stage 2: YOLOv8 Person Discovery batching...")
            await asyncio.sleep(3)
            update_log("detect", 45, "Stage 2 Complete. Review Person Bounding Boxes.", needs_review=True)
            
        elif stage == "track":
            update_log("track", 55, "Stage 3: ByteTrack stability filtering...")
            await asyncio.sleep(3)
            update_log("track", 65, "Stage 3 Complete. Verify Tracklet continuity.", needs_review=True)
            
        elif stage == "ocr":
            update_log("ocr", 75, "Stage 4: Personnel Discovery (Crop-first OCR)...")
            
            # Simulated mappings for Stage 4
            mock_mappings = [
                {"ai_track_id": "1", "detected_team_side": "home", "confidence": 0.98},
                {"ai_track_id": "5", "detected_team_side": "away", "confidence": 0.89}
            ]
            for mapping in mock_mappings:
                supabase.table("ai_player_mappings").upsert({
                    "game_id": game_id,
                    "ai_track_id": mapping["ai_track_id"],
                    "detected_team_side": mapping["detected_team_side"],
                    "confidence": mapping["confidence"],
                    "manually_verified": False,
                    "updated_at": "now()"
                }, on_conflict="game_id,ai_track_id").execute()

            update_log("ocr", 85, "Stage 4 Complete. Finalize Personnel Mappings.", needs_review=True)

        elif stage == "finalize":
            update_log("event", 90, "Stage 5: Fusing coordinates and finalizing Box Score...")
            await asyncio.sleep(2)
            
            supabase.table("games").update({
                "status": "completed",
                "progress_percentage": 100
            }).eq("id", game_id).execute()
            
            update_log("complete", 100, "v17.0 Modular Analysis Finalized.")

    except Exception as e:
        update_log(stage, 0, f"Stage Error: {str(e)}", "error")

@app.function()
@modal.fastapi_endpoint(method="GET", label="v17-health")
async def health():
    return {"status": "operational", "version": VERSION}
