const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

// Database URL from your local .env
const DATABASE_URL = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

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
          reject(new Error(`Failed to set ${key}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Adding DATABASE_URL to Render...\n');
  
  try {
    await setEnvVar('DATABASE_URL', DATABASE_URL);
    console.log('\n✅ Database URL configured!');
    console.log('📝 Triggering new deployment...');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();