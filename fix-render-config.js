const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function updateServiceConfig() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      serviceDetails: {
        env: 'node',
        buildCommand: 'npm install && npx prisma generate',
        startCommand: 'npm start',
        healthCheckPath: '', // Remove health check for now
        envSpecificDetails: {
          buildCommand: 'npm install && npx prisma generate',
          startCommand: 'npm start'
        }
      }
    });
    
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: `/v1/services/${SERVICE_ID}`,
      method: 'PATCH',
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
          console.log('✅ Service configuration updated successfully');
          resolve(JSON.parse(responseData));
        } else {
          console.log(`❌ Failed to update config: ${res.statusCode}`);
          console.log(`Response: ${responseData}`);
          reject(new Error('Failed to update config'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Fixing Render Service Configuration...\n');
  
  try {
    const result = await updateServiceConfig();
    console.log('\n✅ Configuration updated!');
    console.log('Build Command:', result.serviceDetails?.buildCommand || 'Not set');
    console.log('Start Command:', result.serviceDetails?.startCommand || 'Not set');
    console.log('\n📝 Next: Trigger deployment to apply changes');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();