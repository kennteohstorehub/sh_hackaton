const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkService() {
  console.log('🔍 Checking Render Service Details...\n');
  
  try {
    // Get service details
    const service = await makeRequest(`/v1/services/${SERVICE_ID}`);
    console.log('Service Details:');
    console.log('  Name:', service.name);
    console.log('  Type:', service.type);
    console.log('  Repo:', service.repo);
    console.log('  Branch:', service.branch);
    console.log('  Build Command:', service.serviceDetails?.buildCommand);
    console.log('  Start Command:', service.serviceDetails?.startCommand);
    console.log('  Health Check Path:', service.serviceDetails?.healthCheckPath);
    console.log('  Root Directory:', service.rootDir || '.');
    
    // Get latest deployment
    const deploys = await makeRequest(`/v1/services/${SERVICE_ID}/deploys?limit=1`);
    const latestDeploy = deploys[0]?.deploy;
    if (latestDeploy) {
      console.log('\nLatest Deployment:');
      console.log('  Status:', latestDeploy.status);
      console.log('  Commit:', latestDeploy.commit?.message?.substring(0, 60) + '...');
      console.log('  Created:', latestDeploy.createdAt);
      console.log('  Finished:', latestDeploy.finishedAt);
    }
    
    // Check environment variables
    const envVars = await makeRequest(`/v1/services/${SERVICE_ID}/env-vars`);
    console.log('\nEnvironment Variables Set:');
    const envKeys = envVars.map(e => e.envVar.key);
    console.log('  Keys:', envKeys.join(', '));
    
    // Check if required vars are present
    const required = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'];
    const missing = required.filter(key => !envKeys.includes(key));
    if (missing.length > 0) {
      console.log('  ⚠️  Missing:', missing.join(', '));
    } else {
      console.log('  ✅ All required variables present');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkService();