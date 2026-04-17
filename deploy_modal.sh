#!/bin/sh

# Load env vars from .env.local if they exist
if [ -f .env.local ]; then
  # Simple POSIX compatible env loading
  export $(grep -v '^#' .env.local | xargs)
fi

# DribbleStats AI Elite: Direct Modal Deployment Script
# Use this to bypass GitHub Action limits.

set -e

echo "🚀 Initializing DribbleStats AI GPU Deployment..."

# 1. Check for Modal Credentials
if [ -z "$MODAL_TOKEN_ID" ] || [ -z "$MODAL_TOKEN_SECRET" ]; then
  echo "❌ Error: MODAL_TOKEN_ID or MODAL_TOKEN_SECRET is not set."
  echo "Please verify your Environment Settings."
  exit 1
fi

# 2. Install Modal using python3 module path
echo "📦 Installing Modal CLI..."
python3 -m pip install modal --quiet

# 3. Configure Modal Token
echo "🔑 Authenticating with Modal..."
python3 -m modal token set --token-id "$MODAL_TOKEN_ID" --token-secret "$MODAL_TOKEN_SECRET"

# 4. Deploy the Worker
echo "☁️  Deploying modal_worker.py to Modal GPU Cluster..."
python3 -m modal deploy modal_worker.py

echo "✅ Success! Your GPU Scouting Worker is live on Modal."