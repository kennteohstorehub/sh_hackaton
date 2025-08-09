const https = require('https');
const crypto = require('crypto');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function makeRenderRequest(path, method = 'GET', data = null) {
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

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = jsonData.length;
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: responseData ? JSON.parse(responseData) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function fixRenderDeployment() {
  console.log('🔧 Fixing Render Deployment Issues');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Get current service configuration
    console.log('\n📋 Step 1: Checking current service configuration...');
    const serviceResp = await makeRenderRequest(`/v1/services/${SERVICE_ID}`);
    const service = serviceResp.data;
    
    console.log('Service Name:', service.name);
    console.log('Type:', service.type);
    console.log('Root Dir:', service.rootDir || '.');
    console.log('Build Command:', service.serviceDetails?.buildCommand || 'NOT SET');
    console.log('Start Command:', service.serviceDetails?.startCommand || 'NOT SET');
    
    // Step 2: Update service configuration
    console.log('\n🔧 Step 2: Updating service configuration...');
    
    const updateData = {
      name: service.name,
      serviceDetails: {
        env: 'node',
        region: service.region || 'oregon',
        plan: service.plan || 'starter',
        buildCommand: 'npm ci --production=false && npx prisma generate',
        startCommand: 'node server/index.js',
        healthCheckPath: '',
        numInstances: 1,
        envSpecificDetails: {
          buildCommand: 'npm ci --production=false && npx prisma generate',
          startCommand: 'node server/index.js'
        }
      }
    };
    
    const updateResp = await makeRenderRequest(`/v1/services/${SERVICE_ID}`, 'PATCH', updateData);
    console.log('Update Response:', updateResp.status === 200 ? '✅ Success' : `❌ Failed (${updateResp.status})`);
    
    // Step 3: Ensure all environment variables are set
    console.log('\n🔑 Step 3: Verifying environment variables...');
    
    const envVars = [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'PORT', value: '10000' },
      { key: 'JWT_SECRET', value: crypto.randomBytes(32).toString('base64') },
      { key: 'SESSION_SECRET', value: crypto.randomBytes(32).toString('base64') },
      { key: 'DATABASE_URL', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' },
      { key: 'DATABASE_URL_DIRECT', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' },
      { key: 'TRUST_PROXY', value: 'true' },
      { key: 'EMAIL_PROVIDER', value: 'console' },
      { key: 'EMAIL_FROM', value: 'noreply@storehubqms.com' }
    ];
    
    const envResp = await makeRenderRequest(`/v1/services/${SERVICE_ID}/env-vars`, 'PUT', envVars);
    console.log('Environment Variables:', envResp.status === 200 ? '✅ Set' : `❌ Failed (${envResp.status})`);
    
    // Step 4: Clear build cache and trigger new deployment
    console.log('\n🚀 Step 4: Triggering fresh deployment...');
    
    const deployData = {
      clearCache: 'clear' // Clear build cache for fresh start
    };
    
    const deployResp = await makeRenderRequest(`/v1/services/${SERVICE_ID}/deploys`, 'POST', deployData);
    
    if (deployResp.status === 201 || deployResp.status === 200) {
      const deploy = deployResp.data;
      console.log('✅ Deployment triggered!');
      console.log('Deploy ID:', deploy.id);
      console.log('Status:', deploy.status);
      
      // Step 5: Monitor deployment
      console.log('\n📊 Step 5: Monitoring deployment (this may take 3-5 minutes)...');
      
      let attempts = 0;
      let deployStatus = deploy.status;
      
      while (attempts < 30 && !['live', 'build_failed', 'update_failed'].includes(deployStatus)) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        const statusResp = await makeRenderRequest(`/v1/services/${SERVICE_ID}/deploys/${deploy.id}`);
        if (statusResp.data) {
          deployStatus = statusResp.data.status;
          process.stdout.write(`\rStatus: ${deployStatus} (${attempts * 10}s elapsed)`);
        }
        attempts++;
      }
      
      console.log('\n');
      
      if (deployStatus === 'live') {
        console.log('✅ Deployment successful!');
        
        // Test the deployment
        console.log('\n🔍 Testing deployment...');
        await testDeployment();
      } else {
        console.log(`❌ Deployment failed with status: ${deployStatus}`);
        console.log('Check logs at: https://dashboard.render.com/web/srv-d1vojdumcj7s73fjgd6g/logs');
      }
    } else {
      console.log('❌ Failed to trigger deployment:', deployResp.status);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testDeployment() {
  const https = require('https');
  
  const testUrl = (url) => {
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, hasContent: data.length > 0 });
        });
      }).on('error', () => resolve({ status: 'error' }));
    });
  };
  
  const endpoints = [
    'https://queuemanagement.onrender.com/',
    'https://queuemanagement.onrender.com/register',
    'https://queuemanagement.onrender.com/backoffice/login'
  ];
  
  console.log('\nTesting endpoints:');
  for (const url of endpoints) {
    const result = await testUrl(url);
    const path = url.replace('https://queuemanagement.onrender.com', '');
    if (result.status === 200) {
      console.log(`  ✅ ${path || '/'} - Working!`);
    } else {
      console.log(`  ❌ ${path || '/'} - Status: ${result.status}`);
    }
  }
}

// Run the fix
fixRenderDeployment();