const https = require('https');
const crypto = require('crypto');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

// Generate secure random secrets
const generateSecret = (length = 32) => {
  return crypto.randomBytes(length).toString('base64');
};

// ALL required environment variables
const envVars = [
  { key: 'NODE_ENV', value: 'production' },
  { key: 'PORT', value: '10000' },
  { key: 'JWT_SECRET', value: generateSecret(32) },
  { key: 'SESSION_SECRET', value: generateSecret(32) },
  { key: 'WEBHOOK_SECRET', value: generateSecret(32) },
  { key: 'DATABASE_URL', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' },
  { key: 'DATABASE_URL_DIRECT', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' },
  { key: 'TRUST_PROXY', value: 'true' },
  { key: 'EMAIL_PROVIDER', value: 'console' },
  { key: 'EMAIL_FROM', value: 'noreply@storehubqms.com' },
  { key: 'RENDER_API_KEY', value: RENDER_API_KEY },
  { key: 'RENDER_SERVICE_ID', value: SERVICE_ID }
];

async function setAllEnvVars() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(envVars);
    
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
          console.log('✅ All environment variables set successfully');
          resolve(responseData);
        } else {
          console.log(`❌ Failed to set environment variables: ${res.statusCode}`);
          console.log(`Response: ${responseData}`);
          reject(new Error('Failed to set environment variables'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Setting ALL environment variables on Render...\n');
  
  try {
    await setAllEnvVars();
    console.log('\n✅ All environment variables configured!');
    console.log('\nVariables set:');
    envVars.forEach(v => {
      if (v.key.includes('SECRET') || v.key.includes('PASSWORD') || v.key.includes('DATABASE_URL')) {
        console.log(`  - ${v.key}: [REDACTED]`);
      } else {
        console.log(`  - ${v.key}: ${v.value}`);
      }
    });
    console.log('\n📝 Next: Trigger deployment');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();