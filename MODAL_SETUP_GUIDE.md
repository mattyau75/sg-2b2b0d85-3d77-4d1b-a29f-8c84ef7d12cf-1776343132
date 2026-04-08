# Modal GPU Worker Setup Guide with YouTube Authentication

This guide explains how to deploy your basketball stats analysis worker to Modal.com with YouTube cookie authentication.

## Prerequisites

1. **Modal Account**: Sign up at [modal.com](https://modal.com)
2. **Python 3.11+** installed locally
3. **YouTube Account** (logged in to your browser)

## Step 1: Install Modal CLI

```bash
pip install modal
```

## Step 2: Authenticate with Modal

```bash
modal token set --token-id <your-id> --token-secret <your-secret>
```

Get your credentials from: https://modal.com/settings/api-tokens

## Step 3: Export YouTube Cookies (CRITICAL for YouTube videos)

### Option A: Using Browser Extension (Recommended)

1. Install browser extension: **"Get cookies.txt LOCALLY"**
   - Chrome: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/

2. Go to **youtube.com** while logged in

3. Click the extension icon and select "Export cookies"

4. Save the file as `cookies.txt` in the same directory as `modal_worker.py`

### Option B: Manual Cookie Export (Alternative)

1. Open YouTube in your browser (logged in)
2. Open Developer Tools (F12)
3. Go to Application → Cookies → youtube.com
4. Export all cookies in Netscape format

## Step 4: Create Modal Secret with Your Cookies

```bash
# From the directory containing cookies.txt
modal secret create youtube-cookies YOUTUBE_COOKIES="$(cat cookies.txt)"
```

**Verify the secret was created:**
```bash
modal secret list
```

You should see `youtube-cookies` in the list.

## Step 5: Deploy the Worker to Modal

```bash
modal deploy modal_worker.py
```

**Expected output:**
```
✓ Created objects.
├── 🔨 Created mount /path/to/opencv_statgen.py
├── 🔨 Created function analyze.
└── 🔨 Created web endpoint analyze => https://yourname--dribbleai-stats-analyze.modal.run
```

**Copy the endpoint URL** - you'll need it for your Next.js environment variables.

## Step 6: Update Your Softgen Environment Variables

1. In Softgen, go to **Settings** (top right) → **Environment** tab

2. Add or update this variable:
   ```
   MODAL_ENDPOINT_URL=https://yourname--dribbleai-stats-analyze.modal.run
   ```

3. Save and restart the server

## Step 7: Test the Setup

1. Go to your app dashboard
2. Click "Process New Game"
3. Enter a **YouTube URL** (example: `https://www.youtube.com/watch?v=qm0HL2zsKsw`)
4. Fill in team details
5. Click "Start Processing"

**Expected behavior:**
- Progress should update from 0% → 15% → 25% → ... → 100%
- No "Sign in to confirm you're not a bot" errors
- Final status: "Completed"

## Troubleshooting

### Error: "Sign in to confirm you're not a bot"

**Cause**: Cookies are missing or expired

**Solutions**:
1. Re-export cookies from your browser (make sure you're logged into YouTube)
2. Delete and recreate the Modal secret:
   ```bash
   modal secret delete youtube-cookies
   modal secret create youtube-cookies YOUTUBE_COOKIES="$(cat cookies.txt)"
   ```
3. Redeploy: `modal deploy modal_worker.py`

### Error: "Cookies file not found"

**Cause**: The Modal secret wasn't created or named incorrectly

**Solution**:
```bash
# Check if the secret exists
modal secret list

# If it's missing, create it
modal secret create youtube-cookies YOUTUBE_COOKIES="$(cat cookies.txt)"
```

### Error: "Processing stuck at 15%"

**Cause**: Worker can't download the video

**Solutions**:
1. Check Modal logs: `modal app logs dribbleai-stats`
2. Verify cookies are valid (re-export from browser)
3. Try a different video URL to rule out video-specific issues

### Error: "Module not found" or Import errors

**Cause**: Container image needs to be rebuilt

**Solution**:
```bash
# Force rebuild the container
modal deploy --force-rebuild modal_worker.py
```

## GPU Options & Pricing

Change the GPU type in `modal_worker.py` (line ~90):

```python
@app.function(
    gpu="T4",    # Options: "T4", "A10G", "A100"
    ...
)
```

**Performance comparison** (for ~2-minute game video):
- **T4**: ~$0.59/hr → ~2 minutes processing time → ~$0.02/game
- **A10G**: ~$1.10/hr → ~1 minute processing time → ~$0.02/game (Recommended)
- **A100**: ~$3.70/hr → ~30 seconds processing time → ~$0.03/game

**Modal Free Tier**: 30 GPU-hours/month (~900-1800 games, depending on GPU type)

## Alternative: Using Browser Cookie Extraction (No Manual Export)

If you don't want to manually export cookies each time they expire, you can use automatic browser cookie extraction (requires browser in container):

1. **Uncomment these lines in `modal_worker.py`** (around line 70):
   ```python
   # Uncomment these two lines:
   "chromium",
   "chromium-driver",
   ```

2. **Update the cookie handling** (around line 130):
   ```python
   # Comment out the cookies file block
   # if youtube_cookies:
   #     ...

   # Uncomment this instead:
   cmd.extend(["--cookies-from-browser", "chrome"])
   ```

3. **Redeploy**: `modal deploy modal_worker.py`

**Trade-offs**:
- ✅ No manual cookie export needed
- ✅ Cookies auto-update
- ❌ Adds ~500MB to container image
- ❌ Slower cold starts (~5-10 seconds longer)

## Updating the Worker

When you make changes to `opencv_statgen.py` or `modal_worker.py`:

```bash
modal deploy modal_worker.py
```

Modal will automatically:
- Bundle the new `opencv_statgen.py` into the container
- Deploy the updated worker
- Keep the same endpoint URL

## Monitoring & Logs

**View real-time logs:**
```bash
modal app logs dribbleai-stats --follow
```

**View specific function logs:**
```bash
modal function logs dribbleai-stats::analyze
```

## Cost Management

**Check your usage:**
```bash
modal profile
```

**Set spending limits:**
Go to: https://modal.com/settings/billing

**Optimize costs**:
1. Use T4 GPU for development/testing (cheapest)
2. Use A10G for production (best price/performance)
3. Only use A100 if you need sub-30-second processing

## Support

- **Modal Documentation**: https://modal.com/docs
- **Modal Discord**: https://modal.com/discord
- **yt-dlp Cookie Guide**: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp