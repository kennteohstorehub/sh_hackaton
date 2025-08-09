const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: responseData ? JSON.parse(responseData) : null,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function forceFixRender() {
  console.log('🔧 FORCE FIX: Render Deployment');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Suspend the service first
    console.log('\n⏸️  Step 1: Suspending service...');
    const suspendResp = await makeRequest(`/v1/services/${SERVICE_ID}/suspend`, 'POST');
    console.log('Suspend response:', suspendResp.status);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 2: Resume with new configuration
    console.log('\n▶️  Step 2: Resuming service...');
    const resumeResp = await makeRequest(`/v1/services/${SERVICE_ID}/resume`, 'POST');
    console.log('Resume response:', resumeResp.status);
    
    // Step 3: Force update the entire service
    console.log('\n🔧 Step 3: Force updating service configuration...');
    
    const fullUpdate = {
      autoDeploy: 'yes',
      serviceDetails: {
        buildCommand: 'npm install && npx prisma generate',
        startCommand: 'npm start',
        publishPath: '',
        pullRequestPreviewsEnabled: 'no',
        env: 'node',
        region: 'singapore',
        plan: 'starter',
        numInstances: 1
      }
    };
    
    const updateResp = await makeRequest(`/v1/services/${SERVICE_ID}`, 'PUT', fullUpdate);
    console.log('Update response:', updateResp.status);
    
    if (updateResp.status !== 200) {
      console.log('Update failed, trying PATCH...');
      const patchResp = await makeRequest(`/v1/services/${SERVICE_ID}`, 'PATCH', fullUpdate);
      console.log('Patch response:', patchResp.status);
    }
    
    // Step 4: Set environment variables again with complete set
    console.log('\n🔑 Step 4: Setting all environment variables...');
    const envVars = [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'PORT', value: '10000' },
      { key: 'JWT_SECRET', value: 'super-secret-jwt-key-minimum-32-chars-long-2025-prod' },
      { key: 'SESSION_SECRET', value: 'different-secret-key-for-sessions-also-32-chars-prod' },
      { key: 'DATABASE_URL', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' },
      { key: 'DATABASE_URL_DIRECT', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' },
      { key: 'TRUST_PROXY', value: 'true' },
      { key: 'EMAIL_PROVIDER', value: 'console' },
      { key: 'EMAIL_FROM', value: 'noreply@storehubqms.com' },
      { key: 'WEBHOOK_SECRET', value: 'webhook-secret-key-2025-prod' }
    ];
    
    const envResp = await makeRequest(`/v1/services/${SERVICE_ID}/env-vars`, 'PUT', envVars);
    console.log('Environment variables response:', envResp.status);
    
    // Step 5: Trigger a manual deploy with clear cache
    console.log('\n🚀 Step 5: Triggering deployment with cache clear...');
    const deployResp = await makeRequest(`/v1/services/${SERVICE_ID}/deploys`, 'POST', {
      clearCache: 'clear'
    });
    
    if (deployResp.status === 201 || deployResp.status === 200) {
      const deploy = deployResp.data;
      console.log('✅ Deployment triggered');
      console.log('Deploy ID:', deploy.id);
      
      // Monitor deployment
      console.log('\n⏳ Monitoring deployment...');
      let attempts = 0;
      let status = deploy.status;
      
      while (attempts < 40 && !['live', 'build_failed', 'update_failed'].includes(status)) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const statusResp = await makeRequest(`/v1/services/${SERVICE_ID}/deploys/${deploy.id}`);
        if (statusResp.data) {
          status = statusResp.data.status;
          process.stdout.write(`\rStatus: ${status} (${attempts * 10}s)`);
        }
        attempts++;
      }
      
      console.log('\n');
      
      if (status === 'live') {
        console.log('✅ Deployment successful!');
        
        // Test endpoints
        console.log('\n🔍 Testing endpoints...');
        await testEndpoints();
      } else {
        console.log(`❌ Deployment status: ${status}`);
        
        // Try to get logs
        console.log('\nChecking service status...');
        const serviceResp = await makeRequest(`/v1/services/${SERVICE_ID}`);
        if (serviceResp.data) {
          console.log('Service suspended:', serviceResp.data.suspended || false);
          console.log('Build command:', serviceResp.data.serviceDetails?.buildCommand || 'NOT SET');
          console.log('Start command:', serviceResp.data.serviceDetails?.startCommand || 'NOT SET');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testEndpoints() {
  const endpoints = [
    '/',
    '/api/health',
    '/register',
    '/backoffice/login'
  ];
  
  for (const endpoint of endpoints) {
    await new Promise(resolve => {
      https.get(`https://queuemanagement.onrender.com${endpoint}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`✅ ${endpoint} - Status ${res.statusCode}`);
            if (endpoint === '/api/health' && data) {
              console.log(`   Response: ${data.substring(0, 100)}`);
            }
          } else if (res.statusCode === 302 || res.statusCode === 301) {
            console.log(`↪️  ${endpoint} - Redirect ${res.statusCode} to ${res.headers.location}`);
          } else {
            console.log(`❌ ${endpoint} - Status ${res.statusCode}`);
          }
          resolve();
        });
      }).on('error', (err) => {
        console.log(`❌ ${endpoint} - Error: ${err.message}`);
        resolve();
      });
    });
  }
}

// Run the fix
forceFixRender();