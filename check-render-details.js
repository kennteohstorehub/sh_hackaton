const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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

async function checkDetails() {
  console.log('🔍 Checking Render Service Details\n');
  
  const service = await makeRequest(`/v1/services/${SERVICE_ID}`);
  
  console.log('Service Configuration:');
  console.log('=' .repeat(50));
  console.log('ID:', service.id);
  console.log('Name:', service.name);
  console.log('Type:', service.type);
  console.log('Repo:', service.repo);
  console.log('Branch:', service.branch);
  console.log('Root Directory:', service.rootDir || '.');
  console.log('Auto Deploy:', service.autoDeploy);
  console.log('Suspended:', service.suspended || false);
  
  if (service.serviceDetails) {
    console.log('\nService Details:');
    console.log('  Runtime:', service.serviceDetails.env);
    console.log('  Build Command:', service.serviceDetails.buildCommand || 'NOT SET');
    console.log('  Start Command:', service.serviceDetails.startCommand || 'NOT SET');
    console.log('  Health Check:', service.serviceDetails.healthCheckPath || 'NONE');
    console.log('  Plan:', service.serviceDetails.plan);
    console.log('  Region:', service.serviceDetails.region);
    
    if (service.serviceDetails.envSpecificDetails) {
      console.log('\nEnv Specific:');
      console.log('  Build:', service.serviceDetails.envSpecificDetails.buildCommand || 'NOT SET');
      console.log('  Start:', service.serviceDetails.envSpecificDetails.startCommand || 'NOT SET');
    }
  }
  
  // Check if service is actually a static site
  console.log('\n⚠️  Checking service type...');
  if (service.type === 'static_site') {
    console.log('❌ ERROR: This is a STATIC SITE, not a web service!');
    console.log('Static sites cannot run Node.js applications.');
    console.log('You need to create a new Web Service instead.');
  } else if (service.type === 'web_service') {
    console.log('✅ Service type is correct (web_service)');
    
    // Check for common issues
    if (!service.serviceDetails?.env || service.serviceDetails.env !== 'node') {
      console.log('❌ Runtime is not set to Node.js!');
    }
    if (!service.serviceDetails?.buildCommand) {
      console.log('⚠️  No build command set');
    }
    if (!service.serviceDetails?.startCommand) {
      console.log('⚠️  No start command set');
    }
  }
  
  // Get latest deployment
  const deploys = await makeRequest(`/v1/services/${SERVICE_ID}/deploys?limit=1`);
  if (deploys && deploys[0]) {
    const deploy = deploys[0].deploy;
    console.log('\nLatest Deployment:');
    console.log('  Status:', deploy.status);
    console.log('  Commit:', deploy.commit?.message?.substring(0, 50));
    console.log('  Started:', deploy.startedAt);
    console.log('  Finished:', deploy.finishedAt);
  }
}

checkDetails().catch(console.error);