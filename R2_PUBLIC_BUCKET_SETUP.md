# Cloudflare R2 Public Bucket Configuration

## Make Your Video Bucket Public (2 Minutes)

### Step 1: Enable Public Access in Cloudflare Dashboard

1. Log into your Cloudflare Dashboard
2. Navigate to **R2** in the left sidebar
3. Click on your bucket (e.g., `dribblestats-storage` or `videos`)
4. Click **Settings** tab
5. Scroll to **Public Access**
6. Click **Allow Access** or **Connect Domain**

### Step 2: Option A - Use R2.dev Public URL (Fastest)

1. In the bucket settings, click **Public R2.dev Subdomain**
2. Copy the generated URL (e.g., `https://pub-xxxxx.r2.dev`)
3. Add to your `.env.local`:
   ```
   NEXT_PUBLIC_R2_ENDPOINT=https://pub-xxxxx.r2.dev
   ```

### Step 3: Option B - Use Custom Domain (Professional)

1. In bucket settings, click **Connect Domain**
2. Enter your custom domain (e.g., `videos.dribblestats.com.au`)
3. Add the CNAME record to your DNS:
   ```
   CNAME: videos
   Target: [Cloudflare provides this]
   ```
4. Add to your `.env.local`:
   ```
   NEXT_PUBLIC_R2_PUBLIC_DOMAIN=videos.dribblestats.com.au
   ```

### Step 4: Update Environment Variables

Add ONE of these to your `.env.local` (choose based on Step 2 or 3):

```bash
# Option A: R2.dev public URL
NEXT_PUBLIC_R2_ENDPOINT=https://pub-xxxxx.r2.dev
NEXT_PUBLIC_R2_BUCKET_NAME=videos

# OR Option B: Custom domain
NEXT_PUBLIC_R2_PUBLIC_DOMAIN=videos.dribblestats.com.au
NEXT_PUBLIC_R2_BUCKET_NAME=videos
```

### Step 5: Deploy to Vercel

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add the same variable(s) from Step 4
4. Redeploy your application

---

## Security Note

**Videos are now publicly accessible**, which is appropriate for:
- Game footage (not sensitive data)
- Content that requires authentication at the UI level (users must log in to see the page)
- CDN-style delivery (like YouTube, Vimeo, CloudFront)

**The video URL is still "secret"** because:
- Only authorized users see the games list page
- Filenames are UUIDs, not guessable
- Direct linking requires knowing the exact filename

This is the industry-standard approach for video streaming platforms.