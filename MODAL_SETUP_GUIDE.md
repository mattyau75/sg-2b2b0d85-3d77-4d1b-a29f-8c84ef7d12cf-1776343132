# Modal.com Deployment Setup Guide

## Overview
This guide walks you through setting up automated deployment of Python GPU workers to Modal.com from GitHub Actions.

## Prerequisites
- GitHub repository (already set up)
- Modal.com account

## Step 1: Get Modal Authentication Credentials

1. **Sign up/Login to Modal.com:**
   - Go to https://modal.com
   - Create an account or log in

2. **Generate API Token:**
   - Navigate to https://modal.com/settings
   - Click on **"API Tokens"** or **"Tokens"**
   - Click **"Create new token"** or **"New token"**
   - Give it a name like "GitHub Actions"
   - Copy both:
     - `MODAL_TOKEN_ID` (looks like: `ak-xxxxx`)
     - `MODAL_TOKEN_SECRET` (looks like: `as-xxxxx`)
   - **IMPORTANT:** Save these securely—the secret is only shown once

## Step 2: Add Secrets to GitHub Repository

1. **Open GitHub Repository Settings:**
   - Go to: https://github.com/softgenai/sg-2b2b0d85-3d77-4d1b-a29f-8c84ef7d12cf-1775641936/settings/secrets/actions

2. **Add First Secret (Token ID):**
   - Click **"New repository secret"**
   - Name: `MODAL_TOKEN_ID`
   - Value: Paste your Modal token ID (starts with `ak-`)
   - Click **"Add secret"**

3. **Add Second Secret (Token Secret):**
   - Click **"New repository secret"** again
   - Name: `MODAL_TOKEN_SECRET`
   - Value: Paste your Modal token secret (starts with `as-`)
   - Click **"Add secret"**

## Step 3: Trigger the Deployment

### Option A: Automatic Deployment (Recommended)
- Any change you make in Softgen will automatically trigger deployment when pushed to the `main` branch
- The workflow runs automatically on every commit

### Option B: Manual Deployment
1. Go to GitHub Actions: https://github.com/softgenai/sg-2b2b0d85-3d77-4d1b-a29f-8c84ef7d12cf-1775641936/actions
2. Click **"Deploy to Modal.com"** workflow (left sidebar)
3. Click **"Run workflow"** button (right side)
4. Select branch: `main`
5. Click **"Run workflow"** (green button)

## Step 4: Verify Deployment

1. **Check GitHub Actions:**
   - Go to: https://github.com/softgenai/sg-2b2b0d85-3d77-4d1b-a29f-8c84ef7d12cf-1775641936/actions
   - You should see a running workflow with a yellow spinner 🟡
   - Wait for green checkmark ✅ (usually 2-3 minutes)

2. **Check Modal Dashboard:**
   - Go to: https://modal.com/apps
   - You should see an app named `basketball-scout-ai`
   - Click on it to see deployed functions

## Step 5: Test the Deployment

Once deployed, your GPU function is available at:
```
https://[your-modal-workspace]--basketball-scout-ai-process-game-video.modal.run
```

You can invoke it from your DribbleStats app by clicking **"ANALYZE AI DETECTION"** on any game.

## Troubleshooting

### "Invalid credentials" error in GitHub Actions
- Double-check that secrets are named exactly: `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`
- Verify you copied the full token values (they should start with `ak-` and `as-`)
- Regenerate tokens on Modal.com if needed

### "No workflow runs" in GitHub Actions
- Ensure the workflow file exists at `.github/workflows/deploy_gpu.yml`
- Make sure you've pushed changes to the `main` branch
- Check that GitHub Actions are enabled for your repository

### Deployment succeeds but function doesn't work
- Check Modal logs: https://modal.com/logs
- Verify the Python dependencies in `modal_worker.py`
- Ensure the function signature matches your API calls

## Files Involved

- `.github/workflows/deploy_gpu.yml` - GitHub Actions workflow configuration
- `modal_worker.py` - Python GPU worker code that gets deployed to Modal
- GitHub Secrets: `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`

## Next Steps

After successful deployment:
1. Your GPU cluster is live on Modal.com
2. Navigate to any game in DribbleStats
3. Click **"ANALYZE AI DETECTION"** to trigger GPU processing
4. Monitor progress in the "Live Technical Trace" panel