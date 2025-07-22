# 🚀 Render Deployment Guide

This guide will walk you through deploying the StoreHub Queue Management System to Render.

## Prerequisites

- [ ] GitHub account with your code pushed
- [ ] Render account (sign up at render.com)
- [ ] Your Neon database credentials ready

## Step-by-Step Deployment

### 1. Push Your Code to GitHub

```bash
git add .
git commit -m "Prepare for Render deployment - PostgreSQL only"
git push origin main
```

### 2. Deploy to Render

1. **Log in to Render** at https://render.com

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repository**
   - Authorize Render to access your GitHub
   - Select your repository

4. **Configure your service:**
   - **Name**: storehub-queue-system
   - **Region**: Choose closest to your users (Singapore if available)
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`

5. **Choose the Free plan**

### 3. Set Environment Variables

In the Render dashboard, go to your service → Environment tab and add:

#### Required Variables:
```
DATABASE_URL = [Your Neon pooled connection string]
DATABASE_URL_DIRECT = [Your Neon direct connection string]
```

#### Optional Variables (if using these features):
```
# WhatsApp
WHATSAPP_ENFORCE_WHITELIST = false
WHATSAPP_PRODUCTION_MODE = true

# Facebook Messenger
FB_PAGE_ACCESS_TOKEN = [Your token]
FB_VERIFY_TOKEN = [Your verify token]
FB_APP_SECRET = [Your app secret]

# AI Services
OPENAI_API_KEY = [Your OpenAI key]
```

### 4. Deploy

Click "Create Web Service" - Render will:
1. Clone your repository
2. Install dependencies
3. Generate Prisma client
4. Start your application

### 5. Post-Deployment Setup

Once deployed, your app will be available at:
```
https://storehub-queue-system.onrender.com
```

1. **Session table will be created automatically** on first run

2. **Create first merchant account**:
   - Visit: https://your-app.onrender.com/auth/register

3. **Configure webhooks** (if using):
   - WhatsApp: https://your-app.onrender.com/api/webhooks/whatsapp
   - Messenger: https://your-app.onrender.com/api/webhooks/messenger

## What's Changed?

- **No MongoDB Required!** Sessions now use PostgreSQL
- **Simpler Setup** - Only one database to manage
- **Better Performance** - Everything in one database

## Troubleshooting

### Common Issues:

1. **"Build failed"**
   - Check build logs for missing dependencies
   - Ensure all environment variables are set

2. **"Database connection failed"**
   - Verify DATABASE_URL is correct
   - Check if Neon allows connections from Render's IPs

3. **"Session store error"**
   - The session table will be created automatically
   - If issues persist, check PostgreSQL logs

4. **"Port binding error"**
   - Render provides PORT automatically, don't hardcode it

### Monitoring

- **Logs**: Check Render dashboard → Logs
- **Health**: Monitor at https://your-app.onrender.com/api/health
- **Database**: Check Neon dashboard for connection metrics

## Free Tier Limitations

- Service spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Limited build minutes per month

## Production Recommendations

1. **Upgrade to paid plan** for always-on service
2. **Set up custom domain**
3. **Enable auto-deploy** from GitHub
4. **Configure alerts** for downtime
5. **Monitor database connections** in Neon

## Next Steps

1. Test all features in production
2. Configure your messaging integrations
3. Set up monitoring and alerts
4. Create merchant accounts
5. Start accepting customers!

---

Need help? Check the logs in Render dashboard or refer to the main README.