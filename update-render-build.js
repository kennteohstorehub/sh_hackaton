const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function updateBuildCommand() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      serviceDetails: {
        env: 'node',
        buildCommand: 'npm install && npx prisma generate',
        startCommand: 'npm start'
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
          console.log('✅ Build command updated successfully');
          resolve(responseData);
        } else {
          console.log(`❌ Failed to update build command: ${res.statusCode}`);
          console.log(`Response: ${responseData}`);
          reject(new Error('Failed to update build command'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Updating Render build command...\n');
  
  try {
    await updateBuildCommand();
    console.log('\n📝 Next: Redeploy the service');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();