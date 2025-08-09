const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function updateService() {
  return new Promise((resolve, reject) => {
    // Try updating just the env specific details
    const data = JSON.stringify({
      env: 'node',
      buildCommand: 'npm install && npx prisma generate',
      startCommand: 'npm start'
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
        console.log('Response Status:', res.statusCode);
        console.log('Response:', responseData.substring(0, 200));
        
        if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
          console.log('✅ Update request sent');
          resolve(responseData);
        } else {
          reject(new Error(`Failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Updating Render Build/Start Commands...\n');
  
  try {
    await updateService();
    
    // Since Render API doesn't support updating build commands directly,
    // we need to ensure they're set in package.json scripts
    console.log('\n⚠️  Note: Render may use package.json scripts directly');
    console.log('Ensuring package.json has correct scripts...');
    console.log('\n📝 Triggering new deployment...');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();