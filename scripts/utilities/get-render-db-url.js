#!/usr/bin/env node

console.log(`
📋 To seed the demo user in production, you need your Render PostgreSQL URL.

Here's how to get it:

1. Go to https://dashboard.render.com
2. Click on your PostgreSQL database service (not your web service)
3. Look for "Connections" section
4. Copy the "External Database URL"
   - It should look like: postgresql://user:pass@host.frankfurt-postgres.render.com/dbname

5. Once you have it, run ONE of these commands:

   Option A - Direct seeding (recommended):
   ----------------------------------------
   node seed-remote-production.js "YOUR_EXTERNAL_DATABASE_URL"

   Option B - Using environment variable:
   -------------------------------------
   DATABASE_URL="YOUR_EXTERNAL_DATABASE_URL" npm run seed:production

⚠️  IMPORTANT: 
- Use the EXTERNAL database URL (not internal)
- Keep this URL secret - don't commit it to git
- The script will create/update the demo user automatically

Need help? The demo user credentials will be:
- Email: demo@smartqueue.com  
- Password: demo123456
`);