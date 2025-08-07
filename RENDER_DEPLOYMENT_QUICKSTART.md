# Render Deployment Quick Start Guide

## Prerequisites

- GitHub repository with the code
- Render account (free tier works)
- Domain name (optional, for custom domains)

## Step 1: Prepare Your Code

```bash
# Ensure everything works locally
npm install
npm test
npm run build

# Commit all changes
git add .
git commit -m "Add multi-tenant support with subdomain routing"
git push origin main
```

## Step 2: Create Render Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub account and select your repository
4. Render will automatically detect the `render.yaml` file

## Step 3: Configure Environment Variables

In the Render dashboard, add these environment variables:

### Required Variables:
```bash
# Get from Render Account Settings
RENDER_API_KEY=rnd_xxxxxxxxxxxx

# Get from service URL after first deploy (srv-xxxxx)
RENDER_SERVICE_ID=srv_xxxxx

# Generate a secure random string
SESSION_SECRET=your-very-secure-random-string-here
```

### Optional Variables (for production):
```bash
# Email Service (choose one)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxx

# OR
EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
```

## Step 4: Deploy

1. Click "Create Web Service"
2. Render will:
   - Install dependencies
   - Run Prisma migrations
   - Start your application
3. Monitor the deploy logs for any issues

## Step 5: Get Your Service ID

After deployment:
1. Your service URL will be: `https://storehub-qms.onrender.com`
2. The service ID is in the dashboard URL: `https://dashboard.render.com/web/srv-[SERVICE_ID]`
3. Update the `RENDER_SERVICE_ID` environment variable with this ID

## Step 6: Configure Custom Domains

### Option A: Using the Configuration Script
```bash
# Run the configuration script
./configure-render-deployment.sh

# Choose option 2 to configure domains
# Enter your service ID and domain name
```

### Option B: Manual Configuration

1. In Render Dashboard → Settings → Custom Domains
2. Add these domains:
   - `yourdomain.com` (main domain)
   - `*.yourdomain.com` (wildcard for subdomains)
   - `admin.yourdomain.com` (explicit admin domain)

3. Update your DNS:
   ```
   Type  Name  Value
   CNAME @     storehub-qms.onrender.com
   CNAME *     storehub-qms.onrender.com
   CNAME admin storehub-qms.onrender.com
   ```

## Step 7: Create SuperAdmin Account

1. Go to Render Dashboard → Shell
2. Run this command:
   ```bash
   node create-superadmin.js admin@yourdomain.com YourSecurePassword "Admin Name"
   ```
3. Note the credentials and change the password immediately

## Step 8: Test Your Deployment

1. **Health Check**: 
   ```bash
   curl https://your-app.onrender.com/api/health
   ```

2. **SuperAdmin Portal**: 
   - Visit: `https://admin.yourdomain.com`
   - Login with SuperAdmin credentials

3. **Create Test Tenant**:
   - In SuperAdmin portal, create a new tenant
   - Note the subdomain (e.g., `demo`)
   - Visit: `https://demo.yourdomain.com`

## Step 9: Monitor and Scale

### View Logs:
```bash
# Using Render CLI
render logs --service storehub-qms --tail

# Or in dashboard: Logs tab
```

### Monitor Performance:
- Check Metrics tab in Render dashboard
- Set up alerts for downtime
- Monitor database connections

### Scale as Needed:
- Upgrade to paid plan for:
  - Custom domains with SSL
  - More RAM/CPU
  - Zero-downtime deploys
  - Priority support

## Troubleshooting

### Common Issues:

1. **"Database connection failed"**
   - Ensure DATABASE_URL includes `?sslmode=require`
   - Check if database is in same region as service

2. **"Subdomain not working"**
   - Wait for DNS propagation (up to 48 hours)
   - Verify wildcard domain is added in Render
   - Check SSL certificate status

3. **"Build failed"**
   - Check build logs for specific errors
   - Ensure all dependencies are in package.json
   - Verify Node version in package.json engines

4. **"Session issues"**
   - Ensure SESSION_SECRET is set
   - Check TRUST_PROXY is true
   - Verify cookie settings for production

### Quick Fixes:

```bash
# Clear build cache and redeploy
# In Render dashboard: Settings → Clear build cache → Deploy

# Restart service
# In Render dashboard: Manual Deploy → Deploy

# Check environment variables
# In Render dashboard: Environment → Check all values
```

## Security Checklist

- [ ] Strong SESSION_SECRET (min 32 characters)
- [ ] RENDER_API_KEY kept secret
- [ ] SuperAdmin password changed after creation
- [ ] HTTPS enforced (automatic on Render)
- [ ] Environment variables not in code
- [ ] Database backups configured
- [ ] Monitoring alerts set up

## Next Steps

1. **Configure Monitoring**:
   - Set up Render alerts
   - Add external monitoring (UptimeRobot, etc.)
   - Configure error tracking (Sentry, etc.)

2. **Optimize Performance**:
   - Enable caching headers
   - Configure CDN for static assets
   - Optimize database queries

3. **Plan for Growth**:
   - Document scaling strategy
   - Set up staging environment
   - Plan backup and recovery procedures

## Support

- **Render Documentation**: https://render.com/docs
- **Render Status**: https://status.render.com
- **Community Forum**: https://community.render.com

For application-specific issues, check the logs and ensure all environment variables are correctly set.