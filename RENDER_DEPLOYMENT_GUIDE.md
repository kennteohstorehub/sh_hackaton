# 🚀 Render Deployment Guide for StoreHub Queue Management System

## Quick Start Deployment

### Step 1: Fix render.yaml (Already Done ✅)
The `render.yaml` has been updated with:
- `NODE_ENV=production` (fixes the crash)
- `ENABLE_WHATSAPP_WEB=false` (disables WhatsApp for now)

### Step 2: Set Up Database

#### Option A: MongoDB Atlas (Easiest)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your actual password

#### Option B: Use Existing Neon PostgreSQL
If you already have Neon set up, just use those credentials.

### Step 3: Deploy to Render

```bash
# Commit the changes
git add render.yaml
git commit -m "Fix Render deployment - disable WhatsApp, add NODE_ENV"
git push origin main
```

### Step 4: Create Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +" → "Web Service"**
3. Connect your GitHub repo
4. Render will auto-detect the `render.yaml`
5. Click **"Create Web Service"**

### Step 5: Add Database URL

In Render Dashboard → Environment tab, add:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/storehub-queue
```

Or if using PostgreSQL:
```
DATABASE_URL=your_neon_pooled_connection
DATABASE_URL_DIRECT=your_neon_direct_connection
```

### Step 6: Deploy!

Render will automatically:
1. Install dependencies
2. Generate Prisma client
3. Start the server

## ✅ Success Indicators

Look for these in the logs:
- "StoreHub Queue Management System server running on port"
- "Connected to MongoDB" or database connection success
- "Service initialization complete"

## 🌐 Access Your App

Once deployed:
- Dashboard: `https://your-app.onrender.com/dashboard`
- Health Check: `https://your-app.onrender.com/api/health`
- Customer Queue: `https://your-app.onrender.com/`

## 🔧 Troubleshooting

### If it still crashes:
1. Check Render logs for the exact error
2. Verify `NODE_ENV` is set in Environment tab
3. Make sure database URL is correct
4. Check if MongoDB Atlas whitelist includes `0.0.0.0/0` (allow all IPs)

### WhatsApp Options for Later:

1. **Twilio WhatsApp Business API** (Recommended)
   ```
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ENABLE_WHATSAPP_WEB=false
   ```

2. **Deploy WhatsApp on VPS** (If you need WhatsApp Web.js)
   - Use DigitalOcean or AWS EC2
   - Run without Docker (just `npm start`)
   - Sessions will persist properly

## 🎯 Next Steps

1. **Get it running first** without WhatsApp
2. **Test the queue system** works
3. **Then decide** on messaging strategy (Twilio vs VPS)

## Quick Commands

```bash
# Check deployment status
git status

# Push changes
git add .
git commit -m "Update for Render deployment"
git push

# View Render logs (from dashboard)
# Or use Render CLI:
render logs --tail
```

---

**Remember**: The app works perfectly WITHOUT WhatsApp! Get it deployed first, then add messaging.