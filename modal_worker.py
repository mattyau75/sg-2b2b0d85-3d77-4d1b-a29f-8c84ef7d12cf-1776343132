import modal, os
from datetime import datetime

# heavy libs will *only* import inside the Modal container
with modal.imports():
    import cv2
    import numpy as np
    from sklearn.cluster import KMeans
    from ultralytics import YOLO
    from supabase import create_client, Client

# -------------------------------------------------------------------
image = (
    modal.Image.debian_slim().pip_install(
        "supabase",
        "opencv-python-headless",
        "numpy",
        "scikit-learn",
        "ultralytics",
        "httpx",
        "fastapi[standard]",
    )
)

app = modal.App("basketball-scout-ai-process")
volume = modal.Volume.from_name("scout-weights", create_if_missing=True)

# … rest of the code identical to previous message …
