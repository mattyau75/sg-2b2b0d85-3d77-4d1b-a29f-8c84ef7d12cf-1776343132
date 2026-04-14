#!/bin/bash

# Load env vars from .env.local if they exist
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# DribbleStats AI Elite: Direct Modal Deployment Script
# Use this to bypass GitHub Action limits.

set -e

echo "🚀 Initializing DribbleStats AI GPU Deployment..."

# 1. Check for Modal Credentials
if [ -z "$MODAL_TOKEN_ID" ] || [ -z "$MODAL_TOKEN_SECRET" ]; then
  echo "❌ Error: MODAL_TOKEN_ID or MODAL_TOKEN_SECRET is not set in Environment Settings."
  echo "Please add them in Softgen Settings -> Environment tab."
  exit 1
fi

# 2. Install Modal
echo "📦 Installing Modal CLI..."
pip install modal --quiet

# 3. Configure Modal Token
echo "🔑 Authenticating with Modal..."
modal token set --token-id "$MODAL_TOKEN_ID" --token-secret "$MODAL_TOKEN_SECRET"

# 4. Deploy the Worker
echo "☁️  Deploying modal_worker.py to Modal GPU Cluster..."
modal deploy modal_worker.py

echo "✅ Success! Your GPU Scouting Worker is live on Modal."
echo "You can view it at: https://modal.com/apps"