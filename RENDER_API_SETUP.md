# Render API Configuration Guide

## Your API Key is Configured! 🎉

Your Render API key has been saved securely in `.env.render`.

## ⚠️ IMPORTANT SECURITY NOTES

1. **Never commit `.env.render` to Git!** (It's already in .gitignore)
2. **Your API Key**: `rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx`
3. Keep this key secure - it has full access to your Render account

## Next Steps

### 1. Deploy to Render

```bash
# First, ensure your code is pushed to GitHub
git add .
git commit -m "Add multi-tenant architecture"
git push origin main

# Then go to Render Dashboard
# https://dashboard.render.com
```

### 2. Create a New Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Render will detect the `render.yaml` file automatically

### 3. Set Environment Variables in Render

In the Render Dashboard, add these environment variables:

```bash
# Required - Already saved in .env.render
RENDER_API_KEY=rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx

# After first deploy, get this from your service URL
RENDER_SERVICE_ID=srv-xxxxx  # You'll get this after deployment

# Generate a secure session secret
SESSION_SECRET=your-very-secure-random-string-here-min-32-chars

# Optional but recommended
BASE_DOMAIN=yourdomain.com  # Or use storehubqms.onrender.com
EMAIL_PROVIDER=console      # Change to sendgrid/ses for production
```

### 4. After Deployment

Once deployed, you'll get a service ID like `srv-xxxxx`. Update your environment variables:

```bash
RENDER_SERVICE_ID=srv-xxxxx  # Your actual service ID
```

### 5. Test Your Deployment

```bash
# Check if the API key works with Render
curl -H "Authorization: Bearer rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx" \
  https://api.render.com/v1/services

# You should see a list of your services
```

## Local Testing with Your API Key

To test Render API integration locally:

```bash
# Set environment variables
export RENDER_API_KEY=rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx
export MOCK_RENDER_API=false  # Use real API

# Run the server
npm run dev
```

## Configure Custom Domains

After deployment, run:

```bash
# Use the configuration script
./configure-render-deployment.sh

# Your API key is already set, so it will work immediately
# Choose option 2 to configure custom domains
```

## Security Checklist

- [ ] `.env.render` is in `.gitignore` ✅
- [ ] File permissions are restricted (600) ✅
- [ ] Never share this API key publicly
- [ ] Rotate the key periodically
- [ ] Use environment variables, never hardcode

## Quick Commands

```bash
# View your Render services
curl -s -H "Authorization: Bearer rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx" \
  https://api.render.com/v1/services | jq '.[] | {id: .service.id, name: .service.name}'

# Test API connection
node -e "
const renderApi = require('./server/services/renderApiService');
renderApi.testConnection().then(console.log).catch(console.error);
"
```

## Need Help?

- Check `RENDER_DEPLOYMENT_QUICKSTART.md` for full deployment guide
- Run `./configure-render-deployment.sh` for interactive setup
- Render Dashboard: https://dashboard.render.com
- Render Docs: https://render.com/docs