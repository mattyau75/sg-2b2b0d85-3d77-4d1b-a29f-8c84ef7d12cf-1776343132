# Manual Vercel Deployment Guide
## DribbleStats AI Elite - Emergency Deployment Instructions

---

## 🚨 Background
Since Softgen's deployment API is currently experiencing infrastructure issues, this guide will help you deploy your application directly to Vercel using your own account.

---

## ✅ Prerequisites
- A GitHub account
- A Vercel account (free tier works - sign up at https://vercel.com)
- Access to the Softgen project repository

---

## 📋 Step-by-Step Deployment

### STEP 1: Access Your GitHub Repository

1. **In Softgen Interface:**
   - Click **Settings** (gear icon, top right)
   - Navigate to **GitHub** or **Repository** section
   - Look for **"View on GitHub"** or the repository URL
   - Click to open the repository

2. **Add Yourself as Collaborator (if needed):**
   - In Softgen Settings → Find "Repository Access" or "Collaborators"
   - Add your personal GitHub username
   - Check your email for the GitHub invitation and accept it

### STEP 2: Fork the Repository to Your Account

**Option A: Fork (Recommended)**
1. On the GitHub repository page, click **"Fork"** (top right)
2. Choose your personal GitHub account as the destination
3. Wait for the fork to complete

**Option B: Download and Re-upload**
1. Click **"Code"** → **"Download ZIP"**
2. Create a new repository in your GitHub account
3. Upload all the files to the new repository

### STEP 3: Deploy to Vercel

1. **Go to Vercel:**
   - Visit https://vercel.com
   - Sign in with your GitHub account (or create a free account)

2. **Import Project:**
   - Click **"Add New..."** → **"Project"**
   - Click **"Import Git Repository"**
   - Find and select your forked repository
   - Click **"Import"**

3. **Configure Build Settings:**
   Vercel should auto-detect Next.js. Verify these settings:
   - **Framework Preset:** Next.js
   - **Build Command:** `next build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`
   - **Root Directory:** `./` (leave as default)

4. **Add Environment Variables:**
   Click **"Environment Variables"** and add ALL of the following:

---

## 🔐 Required Environment Variables

**Copy these exact values from your Softgen project:**

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://ykqkxkpetdscbcctxqsn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcWt4a3BldGRzY2JjY3R4cXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2OTA4MjAsImV4cCI6MjA0OTI2NjgyMH0.z60D0OikPE8xbdaPKSVdG68qYqwCp1RoAhIpKTDNr1Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcWt4a3BldGRzY2JjY3R4cXNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzY5MDgyMCwiZXhwIjoyMDQ5MjY2ODIwfQ.gVcNTBE4cHN2GvxWHG31kDTgXZ6LDIV87t-ZJ_WDM9k
```

### Cloudflare R2 Storage
```
R2_ACCOUNT_ID=67a17ea0d5fcb064f44fca21e66bc76c
R2_ACCESS_KEY_ID=86db823f64c8ed3aeb17ba4bc1e34b08
R2_SECRET_ACCESS_KEY=3d1eeb1be7d43e7ea38fa4029ee562e7a63b3eef4ba6e48aa1a39815e3cee95b
R2_BUCKET_NAME=dribblestats-videos
R2_PUBLIC_URL=https://pub-7a3bd59cce4940d9b6d6f88c0f0c9c75.r2.dev
```

### Modal.com GPU Worker
```
MODAL_USER_URL=https://robhami--opencv-statgen-process.modal.run
MODAL_TOKEN_ID=ak-QTEI5uHoJwzx3bWlYDcsjT
MODAL_TOKEN_SECRET=as-HB6f3LgqE0LqQh0C6FVEHq
MODAL_AUTH_TOKEN=as-HB6f3LgqE0LqQh0C6FVEHq
```

### Next.js Configuration
```
NEXT_PUBLIC_SITE_URL=https://dribblestats.com.au
NODE_ENV=production
```

---

## ⚙️ STEP 4: Deploy

1. After adding all environment variables, click **"Deploy"**
2. Vercel will:
   - Clone your repository
   - Install dependencies
   - Build the Next.js application
   - Deploy to a production URL
3. Wait 2-5 minutes for the build to complete

---

## ✅ STEP 5: Verify Deployment

1. **Check Build Logs:**
   - Click on the deployment in Vercel dashboard
   - Review the build logs for any errors
   - Look for "Build Completed" and "Deployment Ready"

2. **Test Your Application:**
   - Vercel will provide a URL like: `https://your-project-name.vercel.app`
   - Click "Visit" to open your deployed application
   - Test key features:
     - Login/Authentication
     - Game creation
     - Video upload (if applicable)
     - Roster management

3. **Custom Domain (Optional):**
   - In Vercel project settings → **Domains**
   - Add your custom domain: `dribblestats.com.au`
   - Follow Vercel's DNS configuration instructions

---

## 🔧 Troubleshooting

### Build Fails with "Environment Variable Missing"
- Double-check you added ALL variables from the list above
- Ensure there are no typos in variable names
- Variable names are case-sensitive

### Build Fails with "Module Not Found"
- Check that `package.json` and `package-lock.json` are in the repository
- Ensure all dependencies are properly listed

### Supabase Connection Errors
- Verify the Supabase URL and keys are correct
- Check that your Supabase project is still active
- Test the connection in Supabase dashboard

### R2 Storage Not Working
- Verify R2 credentials are correct
- Check CORS settings in Cloudflare R2 dashboard
- Ensure bucket name matches exactly

### Modal.com GPU Worker Issues
- Verify the Modal.com deployment is still active
- Check that the `MODAL_USER_URL` is accessible
- Confirm auth tokens haven't expired

---

## 🆘 Need Help?

If you encounter issues:
1. Check Vercel's build logs for specific error messages
2. Review the Vercel documentation: https://vercel.com/docs
3. Contact Vercel support: https://vercel.com/support
4. Once Softgen support responds, they may be able to help with repository access

---

## 📝 Notes

- **Free Tier Limits:** Vercel's free tier is generous but has limits on build minutes and bandwidth
- **Environment Updates:** If you need to update environment variables, go to Vercel Project Settings → Environment Variables
- **Redeployment:** Push changes to your GitHub repository to trigger automatic redeployments
- **Domain:** You can add your custom domain (dribblestats.com.au) in Vercel's domain settings

---

## ✨ Success!

Once deployed, your DribbleStats AI Elite platform will be live and accessible at your Vercel URL. You can then point your custom domain to it and manage deployments independently of Softgen.

**Your application is production-ready and this deployment method is 100% legitimate and supported by Vercel.**