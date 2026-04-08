#!/usr/bin/env python3
"""
DribbleAI Stats — Modal GPU Worker (Modal 1.x API)
====================================================
Deploys opencv_statgen.py to a T4 GPU container on Modal and exposes it as a
streaming HTTP endpoint that emits the same JSON-line protocol the local
subprocess uses (__progress / __result / __error).

Quick-start
-----------
1.  pip install modal
2.  modal token set --token-id <id> --token-secret <secret>
3.  (OPTIONAL) Export YouTube cookies and create a Modal secret:
    modal secret create youtube-cookies YOUTUBE_COOKIES="$(cat cookies.txt)"
4.  modal deploy modal_worker.py
5.  Copy the printed endpoint URL to your Next.js environment variables.

GPU options (change gpu= below)
--------------------------------
  "T4"   — ~$0.59/hr  — ~0.8 s/frame yolo11m  → 129 frames ≈  2 min
  "A10G" — ~$1.10/hr  — ~0.4 s/frame yolo11m  → 129 frames ≈  1 min
  "A100" — ~$3.70/hr  — ~0.2 s/frame yolo11m  → 129 frames ≈ 30 sec

YouTube Cookie Authentication
------------------------------
To bypass YouTube's bot detection, you have two options:

Option 1 - Use Modal Secret (Recommended):
  1. Export cookies from your browser using "Get cookies.txt LOCALLY" extension
  2. Create Modal secret: modal secret create youtube-cookies YOUTUBE_COOKIES="$(cat cookies.txt)"
  3. The worker will automatically use these cookies

Option 2 - Use Browser Cookie Extraction:
  1. Uncomment the Chrome/Firefox installation in the image setup below
  2. Uncomment the cookiesfrombrowser line in the subprocess args
  3. Note: This adds ~500MB to the container and increases cold start time
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import modal

# ── App ────────────────────────────────────────────────────────────────────────

app = modal.App("dribbleai-stats")

# ── Container image ────────────────────────────────────────────────────────────
# In Modal 1.x, local files are bundled into the image via .add_local_file()
# rather than the removed modal.Mount API.

_SCRIPT_PATH = str(Path(__file__).parent / "opencv_statgen.py")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        "libgl1",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev",
        "tesseract-ocr",
        "tesseract-ocr-eng",
        "ffmpeg",
        # OPTIONAL: Uncomment to enable browser cookie extraction (adds ~500MB to image)
        # "chromium",
        # "chromium-driver",
    ])
    .pip_install([
        "ultralytics>=8.3",
        "opencv-python-headless>=4.9",
        "pytesseract>=0.3.10",
        "numpy>=1.26",
        "yt-dlp>=2024.4",
        "requests",
        "fastapi[standard]",
    ])
    .add_local_file(_SCRIPT_PATH, remote_path="/app/opencv_statgen.py")
)

# ── Persistent volume — caches YOLO weight files across cold starts ─────────────
# On first invocation ultralytics auto-downloads yolo11m.pt / yolo11n.pt /
# yolo11n-pose.pt from GitHub releases into this volume.  Subsequent cold starts
# skip the download entirely.

weights_volume = modal.Volume.from_name("dribbleai-yolo-weights", create_if_missing=True)
WEIGHTS_DIR = "/cache/yolo"


# ── Combined GPU web endpoint ──────────────────────────────────────────────────
# Runs entirely inside the GPU container (no cross-function generator hop).
# Modal 1.x supports combining @modal.web_endpoint with gpu= on the same
# function — the HTTP handler itself executes on the GPU machine and streams
# the subprocess stdout back to the caller.

@app.function(
    gpu="A10G",
    image=image,
    volumes={WEIGHTS_DIR: weights_volume},
    timeout=7200,
    memory=8192,
    secrets=[modal.Secret.from_name("youtube-cookies", required=False)],
)
@modal.fastapi_endpoint(method="POST")
def analyze(item: dict):
    """
    POST endpoint consumed by the Next.js API server.

    Request body (JSON):
        {
          "video_url":   "<YouTube URL or direct video URL>",
          "home_team":   "Lakers",
          "away_team":   "Celtics",
          "home_roster": [{"name": "Player A", "number": "23"}, ...],
          "away_roster": [{"name": "Player B", "number": "11"}, ...]
        }

    Response: streaming text/plain — one JSON object per line:
        {"__progress": 10, "__msg": "Loading models..."}
        {"__progress": 45, "__msg": "Frame 60/129 (30s elapsed)"}
        {"__result": { ...full opencv analysis dict... }}
    """
    from fastapi.responses import StreamingResponse

    env = os.environ.copy()
    env["YOLO_CONFIG_DIR"] = WEIGHTS_DIR
    env["HOME"] = WEIGHTS_DIR

    # Prepare subprocess command
    cmd = [
        sys.executable, "/app/opencv_statgen.py",
        "--url",         item["video_url"],
        "--home",        item.get("home_team", "Home Team"),
        "--away",        item.get("away_team", "Away Team"),
        "--home-roster", json.dumps(item.get("home_roster", [])),
        "--away-roster", json.dumps(item.get("away_roster", [])),
    ]

    # Handle YouTube cookies if available
    cookies_file = None
    youtube_cookies = os.environ.get("YOUTUBE_COOKIES")
    
    if youtube_cookies:
        # Write cookies to a temporary file
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write(youtube_cookies)
            cookies_file = f.name
        cmd.extend(["--cookies", cookies_file])
        print(f"Using YouTube cookies from Modal secret (file: {cookies_file})")
    else:
        # ALTERNATIVE: Use browser cookie extraction (requires browser installation)
        # Uncomment the next two lines and comment out the above block
        # cmd.extend(["--cookies-from-browser", "chrome"])
        # print("Using browser cookie extraction (chrome)")
        print("WARNING: No YouTube cookies configured. YouTube videos may fail with bot detection.")
        print("To fix: Create Modal secret 'youtube-cookies' with your exported cookies.txt")

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )

    def stream():
        for line in proc.stdout:
            stripped = line.rstrip("\n")
            if stripped:
                yield stripped + "\n"
        
        proc.wait()
        
        # Cleanup temporary cookies file if created
        if cookies_file and os.path.exists(cookies_file):
            try:
                os.unlink(cookies_file)
            except:
                pass
        
        if proc.returncode != 0:
            stderr_output = proc.stderr.read()
            # Capture full stderr for better debugging
            error_msg = f"Script exited with code {proc.returncode}:\n{stderr_output}"
            print(f"ERROR: {error_msg}", file=sys.stderr)
            yield json.dumps({
                "__error": error_msg
            }) + "\n"

    return StreamingResponse(stream(), media_type="text/plain")