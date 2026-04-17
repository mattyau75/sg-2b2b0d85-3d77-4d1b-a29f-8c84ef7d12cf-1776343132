#!/bin/sh

# Load env vars from .env.local if they exist
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

set -e

echo "🚀 Initializing DribbleStats AI GPU Deployment..."

# 1. Detection Phase
PYTHON_CMD=$(which python3 || which python)
if [ -z "$PYTHON_CMD" ]; then
  echo "❌ Error: Python 3 not found in environment."
  exit 1
fi

# 2. Check for Modal Credentials
if [ -z "$MODAL_TOKEN_ID" ] || [ -z "$MODAL_TOKEN_SECRET" ]; then
  echo "❌ Error: MODAL_TOKEN_ID or MODAL_TOKEN_SECRET is not set."
  echo "Please verify your Environment Settings."
  exit 1
fi

# 3. Install Modal CLI
echo "📦 Installing Modal CLI (Approx 30s)..."
$PYTHON_CMD -m pip install modal --quiet

# 4. Configure Modal Token
echo "🔑 Authenticating..."
$PYTHON_CMD -m modal token set --token-id "$MODAL_TOKEN_ID" --token-secret "$MODAL_TOKEN_SECRET"

# 5. Deploy the Worker
echo "☁️  Deploying GPU Cluster (First run takes 3-5 mins for AI library setup)..."
$PYTHON_CMD -m modal deploy modal_worker.py

echo "✅ SUCCESS: Your GPU Scouting Worker is live on Modal."