const https = require('https');
const crypto = require('crypto');

// Your Render credentials
const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

// Generate secure random secrets
const generateSecret = (length = 32) => {
  return crypto.randomBytes(length).toString('base64');
};

// Environment variables to set
const envVars = [
  { key: 'NODE_ENV', value: 'production' },
  { key: 'JWT_SECRET', value: generateSecret(32) },
  { key: 'SESSION_SECRET', value: generateSecret(32) },
  { key: 'WEBHOOK_SECRET', value: generateSecret(32) },
  { key: 'TRUST_PROXY', value: 'true' },
  { key: 'EMAIL_PROVIDER', value: 'console' },
  { key: 'EMAIL_FROM', value: 'noreply@storehubqms.com' },
  { key: 'RENDER_API_KEY', value: RENDER_API_KEY },
  { key: 'RENDER_SERVICE_ID', value: SERVICE_ID }
];

async function setEnvVar(key, value) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify([{ key, value }]);
    
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: `/v1/services/${SERVICE_ID}/env-vars`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Set ${key}`);
          resolve(responseData);
        } else {
          console.log(`❌ Failed to set ${key}: ${res.statusCode}`);
          console.log(`Response: ${responseData}`);
          reject(new Error(`Failed to set ${key}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error setting ${key}:`, error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function configureRenderEnv() {
  console.log('🚀 Configuring Render environment variables...\n');
  
  for (const { key, value } of envVars) {
    try {
      await setEnvVar(key, value);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to set ${key}:`, error.message);
    }
  }
  
  console.log('\n✅ Environment variables configured!');
  console.log('\n📝 Next steps:');
  console.log('1. The service should auto-deploy from GitHub');
  console.log('2. Wait for deployment to complete (~5-10 minutes)');
  console.log('3. Access your app at: https://storehub-qms.onrender.com');
  console.log('4. Run database setup: node setup-production-accounts.js');
}

// Run the configuration
configureRenderEnv().catch(console.error);