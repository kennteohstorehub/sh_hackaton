# Local Subdomain Testing Guide

## Overview
This guide explains how to test the multi-tenant subdomain feature locally and deploy it on Render.

## Local Development Setup

### 1. Configure Local DNS

#### Option A: Using /etc/hosts (Simple but Manual)
Edit your hosts file to map subdomains to localhost:

```bash
# On macOS/Linux
sudo nano /etc/hosts

# Add these lines:
127.0.0.1   storehubqms.local
127.0.0.1   admin.storehubqms.local
127.0.0.1   test-restaurant-1.storehubqms.local
127.0.0.1   test-restaurant-2.storehubqms.local
127.0.0.1   demo.storehubqms.local
```

#### Option B: Using dnsmasq (Automatic Wildcard)
Install and configure dnsmasq for wildcard subdomain support:

```bash
# macOS
brew install dnsmasq

# Configure dnsmasq
echo "address=/.storehubqms.local/127.0.0.1" > /usr/local/etc/dnsmasq.conf

# Start dnsmasq
sudo brew services start dnsmasq

# Add to DNS resolvers
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/storehubqms.local
```

#### Option C: Using lvh.me (Zero Configuration)
Use the free lvh.me service that resolves to 127.0.0.1:

```bash
# No setup required! These work automatically:
# http://lvh.me:3838
# http://admin.lvh.me:3838
# http://test-restaurant-1.lvh.me:3838
# http://any-subdomain.lvh.me:3838
```

### 2. Update Environment Configuration

Create or update `.env.local`:

```bash
# Local development settings
NODE_ENV=development
BASE_DOMAIN=storehubqms.local  # or use lvh.me
SUPERADMIN_DOMAIN=admin.storehubqms.local
PORT=3838

# For lvh.me option:
# BASE_DOMAIN=lvh.me
# SUPERADMIN_DOMAIN=admin.lvh.me

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/storehub_multitenant

# Session
SESSION_SECRET=your-secret-key-here

# Disable Render API in local (we'll mock it)
RENDER_API_KEY=mock-key-for-local
RENDER_SERVICE_ID=mock-service-id
MOCK_RENDER_API=true

# Email (use console for local)
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@storehubqms.local
```

### 3. Update Tenant Resolution for Local Development

Create a local development helper:

```javascript
// server/middleware/tenantResolver.local.js
const logger = require('../utils/logger');

// Local domain mappings for development
const LOCAL_DOMAINS = [
  'storehubqms.local',
  'lvh.me',
  'localhost'
];

function isLocalDomain(hostname) {
  return LOCAL_DOMAINS.some(domain => 
    hostname.endsWith(domain) || hostname.includes(domain + ':')
  );
}

function extractSubdomainLocal(hostname) {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Check each local domain
  for (const domain of LOCAL_DOMAINS) {
    if (host.endsWith(domain)) {
      const subdomain = host.replace(`.${domain}`, '');
      if (subdomain !== domain) {
        return subdomain;
      }
    }
  }
  
  return null;
}

module.exports = {
  isLocalDomain,
  extractSubdomainLocal
};
```

### 4. Update tenantResolver.js

Update the tenant resolver to support local development:

```javascript
// In server/middleware/tenantResolver.js
// Add at the top
const { isLocalDomain, extractSubdomainLocal } = require('./tenantResolver.local');

// Update the resolveTenant function
async function resolveTenant(req, res, next) {
  try {
    const hostname = req.hostname || req.get('host').split(':')[0];
    logger.info(`Resolving tenant for hostname: ${hostname}`);
    
    let subdomain = null;
    
    // Check if local development
    if (process.env.NODE_ENV === 'development' && isLocalDomain(hostname)) {
      subdomain = extractSubdomainLocal(hostname);
      logger.info(`Local development - extracted subdomain: ${subdomain}`);
    } else {
      // Production subdomain extraction (existing code)
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        subdomain = parts[0];
      }
    }
    
    // Rest of the existing code...
```

### 5. Create Local Test Script

```javascript
// test-local-subdomains.js
const axios = require('axios');
const prisma = require('./server/utils/prisma');
const logger = require('./server/utils/logger');

const BASE_URL = process.env.BASE_DOMAIN === 'lvh.me' 
  ? 'http://lvh.me:3838' 
  : 'http://storehubqms.local:3838';

async function createTestTenants() {
  logger.info('Creating test tenants for local development...');
  
  const testTenants = [
    {
      name: 'Demo Restaurant',
      slug: 'demo',
      adminEmail: 'admin@demo.local',
      adminName: 'Demo Admin',
      adminPassword: 'Demo123!@#'
    },
    {
      name: 'Test Cafe',
      slug: 'test-cafe',
      adminEmail: 'admin@testcafe.local',
      adminName: 'Test Admin',
      adminPassword: 'Test123!@#'
    }
  ];
  
  for (const tenantData of testTenants) {
    try {
      // Check if tenant already exists
      const existing = await prisma.tenant.findUnique({
        where: { slug: tenantData.slug }
      });
      
      if (!existing) {
        // Create tenant using the service
        const tenantService = require('./server/services/tenantService');
        await tenantService.create({
          ...tenantData,
          plan: 'basic',
          billingCycle: 'monthly',
          maxMerchants: 3,
          maxQueuesPerMerchant: 5,
          maxCustomersPerQueue: 100
        });
        
        logger.info(`✅ Created test tenant: ${tenantData.name} (${tenantData.slug})`);
      } else {
        logger.info(`ℹ️  Test tenant already exists: ${tenantData.name}`);
      }
    } catch (error) {
      logger.error(`Failed to create tenant ${tenantData.name}:`, error);
    }
  }
}

async function testSubdomains() {
  logger.info('\n🧪 Testing Local Subdomain Access...\n');
  
  const testUrls = [
    { url: BASE_URL, description: 'Main domain (should show no-subdomain page)' },
    { url: `http://admin.${BASE_URL.replace('http://', '')}`, description: 'SuperAdmin portal' },
    { url: `http://demo.${BASE_URL.replace('http://', '')}`, description: 'Demo tenant' },
    { url: `http://test-cafe.${BASE_URL.replace('http://', '')}`, description: 'Test Cafe tenant' },
    { url: `http://nonexistent.${BASE_URL.replace('http://', '')}`, description: 'Non-existent tenant' }
  ];
  
  for (const test of testUrls) {
    try {
      const response = await axios.get(test.url, {
        maxRedirects: 0,
        validateStatus: () => true
      });
      
      logger.info(`✅ ${test.description}`);
      logger.info(`   URL: ${test.url}`);
      logger.info(`   Status: ${response.status}`);
      logger.info(`   Title: ${response.data.match(/<title>(.*?)<\/title>/)?.[1] || 'N/A'}\n`);
    } catch (error) {
      logger.error(`❌ ${test.description}: ${error.message}`);
    }
  }
}

// Run tests
(async () => {
  await createTestTenants();
  await testSubdomains();
  await prisma.$disconnect();
})();
```

### 6. Running Locally

```bash
# 1. Start PostgreSQL
brew services start postgresql

# 2. Run migrations
npx prisma migrate dev

# 3. Start the server
npm run dev

# 4. Create test tenants
node test-local-subdomains.js

# 5. Access the sites:
# - Main: http://storehubqms.local:3838 (or http://lvh.me:3838)
# - Admin: http://admin.storehubqms.local:3838
# - Demo: http://demo.storehubqms.local:3838
```

## Render Deployment Guide

### 1. Render Configuration

Create `render.yaml` in your project root:

```yaml
services:
  - type: web
    name: storehub-qms
    env: node
    region: oregon
    plan: standard
    buildCommand: npm install && npx prisma generate && npx prisma migrate deploy
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: BASE_DOMAIN
        value: storehubqms.com
      - key: SUPERADMIN_DOMAIN
        value: admin.storehubqms.com
      - key: DATABASE_URL
        fromDatabase:
          name: storehub-qms-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true
      - key: RENDER_API_KEY
        sync: false # Set manually in dashboard
      - key: RENDER_SERVICE_ID
        sync: false # Will be set after first deploy
      - key: EMAIL_PROVIDER
        value: sendgrid
      - key: SENDGRID_API_KEY
        sync: false # Set manually
      - key: EMAIL_FROM
        value: noreply@storehubqms.com

databases:
  - name: storehub-qms-db
    databaseName: storehub_qms
    user: storehub_qms
    region: oregon
    plan: standard

# Custom domains will be added programmatically
```

### 2. Deploy to Render

```bash
# 1. Create a new Web Service on Render
# 2. Connect your GitHub repository
# 3. Use the render.yaml for configuration
# 4. Set environment variables in Render dashboard:
#    - RENDER_API_KEY (get from Render account settings)
#    - SENDGRID_API_KEY (if using SendGrid)
#    - Any other sensitive values

# 5. After first deploy, get the service ID:
#    - Go to your service dashboard
#    - The service ID is in the URL: https://dashboard.render.com/web/srv-[SERVICE_ID]
#    - Set RENDER_SERVICE_ID environment variable

# 6. Configure custom domain in Render:
#    - Add storehubqms.com as custom domain
#    - Add *.storehubqms.com for wildcard subdomains
#    - Update your DNS with Render's values
```

### 3. DNS Configuration for Production

Add these DNS records to your domain provider:

```
# Root domain
A     @     35.xxx.xxx.xxx  (Render's IP)
A     @     35.xxx.xxx.xxx  (Render's IP - they provide 2)

# Wildcard for subdomains
CNAME *.    your-service.onrender.com.

# OR if your DNS provider doesn't support wildcard:
CNAME admin your-service.onrender.com.
CNAME www   your-service.onrender.com.
# Add more as needed
```

### 4. Post-Deployment Setup

```bash
# 1. Run database migrations (Render will do this automatically with buildCommand)

# 2. Create SuperAdmin account
# SSH into Render service or use Render Shell:
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  const email = 'superadmin@storehubqms.com';
  const password = 'ChangeMeImmediately123!';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  await prisma.superAdmin.create({
    data: {
      email,
      password: hashedPassword,
      fullName: 'Super Administrator',
      isActive: true
    }
  });
  
  console.log('SuperAdmin created:', email);
  console.log('Temporary password:', password);
  console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
}

createSuperAdmin().then(() => process.exit(0));
"

# 3. Test subdomain creation
# Visit https://admin.storehubqms.com
# Login with SuperAdmin credentials
# Create a test tenant
# Verify subdomain is accessible
```

### 5. Render API Integration

The `renderApiService.js` will automatically provision subdomains when creating tenants. Ensure:

1. `RENDER_API_KEY` is set correctly
2. `RENDER_SERVICE_ID` matches your service
3. The service has permissions to manage custom domains

### 6. Monitoring on Render

```bash
# View logs
render logs --service storehub-qms --tail

# Check custom domains
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/$RENDER_SERVICE_ID/custom-domains

# Monitor health
curl https://storehubqms.com/api/health
```

## Troubleshooting

### Local Issues

1. **"Cannot resolve domain"**
   - Check /etc/hosts entries
   - Try using lvh.me instead
   - Ensure no conflicting DNS cache

2. **"Tenant not found"**
   - Run test-local-subdomains.js to create tenants
   - Check PostgreSQL is running
   - Verify DATABASE_URL is correct

3. **"Session issues"**
   - Clear browser cookies
   - Check SESSION_SECRET is set
   - Ensure Redis is running (if using Redis sessions)

### Render Issues

1. **"Custom domain not working"**
   - Wait for DNS propagation (up to 48 hours)
   - Verify DNS records are correct
   - Check SSL certificate status in Render

2. **"Subdomain creation fails"**
   - Verify RENDER_API_KEY has correct permissions
   - Check service has custom domain addon
   - Look at Render API response in logs

3. **"Database connection issues"**
   - Ensure DATABASE_URL includes ?sslmode=require
   - Check database is in same region as service
   - Verify connection pool settings

## Security Considerations

1. **Local Development**
   - Never use production data locally
   - Use different SESSION_SECRET
   - Disable external integrations

2. **Production**
   - Enable all security headers
   - Use strong SESSION_SECRET
   - Configure rate limiting
   - Enable HTTPS only
   - Set secure cookie flags

## Next Steps

1. Test tenant creation flow end-to-end
2. Verify email notifications work
3. Test subscription limits
4. Configure monitoring and alerts
5. Set up automated backups
6. Plan tenant onboarding process