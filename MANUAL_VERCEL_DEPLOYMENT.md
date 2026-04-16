# DribbleStats AI Elite: Production Environment Handshake

Copy and paste these exact key/value pairs into your Vercel Project Settings (Settings -> Environment Variables).

## 🔑 Core Services

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uegagjhqvgqnmwwukuea.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZ2Fnamhxdmdxbm13d3VrdWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI1NTY1MjMsImV4cCI6MjAyODEzMjUyM30.IjRJ6JmZY7_Aj3xJOajQsVECXBY7kGLTOl-FnIoF8KY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZ2Fnamhxdmdxbm13d3VrdWVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxMjU1NjUyMywiZXhwIjoyMDI4MTMyNTIzfQ.cxT0bgbb_hZtZVGjWaQKXd_Rkr54UJ-PbFWqfUmW2vc` |
| `NEXT_PUBLIC_SITE_URL` | `https://dribblestats.com.au` |

## 🎥 Modal GPU Worker

| Key | Value |
| :--- | :--- |
| `MODAL_USER_URL` | `https://mattjeffs--basketball-scout-ai-analyze.modal.run` |
| `MODAL_AUTH_TOKEN` | `as-bKB4Np4L8WxsoVhsczF4Aw` |
| `MODAL_TOKEN_ID` | `ak-YPkTNdFxNVMm3bq0uy1xWV` |
| `MODAL_TOKEN_SECRET` | `as-e9iSPT7Q6AKN8pNz1hQQcQ` |
| `MODAL_WEBHOOK_URL` | `https://mattjeffs--basketball-scout-ai-analyze.modal.run` |
| `MODAL_URL` | `https://mattjeffs--basketball-scout-ai-analyze.modal.run` |
| `MODAL_USER_NAME` | `mattjeffs` |
| `MODAL_APP_NAME` | `basketball-scout-ai` |

## ☁️ Cloudflare R2 Storage

⚠️ **R2 API tokens must be regenerated** - Get fresh credentials from Cloudflare:

1. Go to **dash.cloudflare.com** → **R2** → **Manage R2 API Tokens**
2. **Create new token** → Name: "DribbleStats Production"
3. Permissions: **Object Read & Write**, Scope: `videos` bucket
4. Copy the credentials and add to Vercel:

| Key | Value |
| :--- | :--- |
| `R2_ACCOUNT_ID` | `a7732b05eed44346d0b8d0e6edd40ad3` |
| `R2_ACCESS_KEY_ID` | `[PASTE NEW ACCESS KEY FROM CLOUDFLARE]` |
| `R2_SECRET_ACCESS_KEY` | `[PASTE NEW SECRET KEY FROM CLOUDFLARE]` |
| `NEXT_PUBLIC_R2_BUCKET_NAME` | `videos` |
| `R2_ENDPOINT` | `https://a7732b05eed44346d0b8d0e6edd40ad3.r2.cloudflarestorage.com` |
| `NEXT_PUBLIC_R2_ENDPOINT` | `https://pub-fa42028a0f9146ecb0d848e7abcbbe01.r2.dev` |

---

## 🛠️ Post-Configuration Steps

1. **Add all keys above** to Vercel Settings → Environment Variables
2. **Generate fresh R2 credentials** from Cloudflare (see R2 section above)
3. Go to **Deployments** → Click **"Redeploy"** on latest build
4. Wait ~2 minutes for deployment to complete

---

## ✅ Verification

After deployment:
1. Visit `https://dribblestats.com.au`
2. Upload a test video
3. Click "Ignite AI Analysis"
4. Verify GPU processing starts successfully