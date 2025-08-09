const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function updateService() {
  return new Promise((resolve, reject) => {
    // Update with complete service details structure
    const data = JSON.stringify({
      serviceDetails: {
        buildCommand: 'npm install && npx prisma generate',
        startCommand: 'node test-server.js',
        env: 'node'
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
        console.log('Response Status:', res.statusCode);
        if (res.statusCode === 200 || res.statusCode === 204) {
          console.log('✅ Service updated successfully');
          resolve(true);
        } else {
          console.log('Response:', responseData);
          resolve(false);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function triggerDeploy() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ clearCache: 'clear' });
    
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: `/v1/services/${SERVICE_ID}/deploys`,
      method: 'POST',
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
          const deploy = JSON.parse(responseData);
          console.log('✅ Deployment triggered');
          console.log('Deploy ID:', deploy.id);
          resolve(deploy.id);
        } else {
          console.log('Failed to trigger deployment:', res.statusCode);
          resolve(null);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function checkDeploymentStatus(deployId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: `/v1/services/${SERVICE_ID}/deploys/${deployId}`,
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
          const deploy = JSON.parse(data);
          resolve(deploy.status);
        } catch (e) {
          resolve('unknown');
        }
      });
    });

    req.on('error', () => resolve('error'));
    req.end();
  });
}

async function main() {
  console.log('🔧 Final Fix for Render Deployment\n');
  
  // Step 1: Update service configuration
  console.log('Step 1: Updating service configuration...');
  const updated = await updateService();
  
  if (!updated) {
    console.log('❌ Failed to update service');
    return;
  }
  
  // Step 2: Trigger deployment
  console.log('\nStep 2: Triggering deployment...');
  const deployId = await triggerDeploy();
  
  if (!deployId) {
    console.log('❌ Failed to trigger deployment');
    return;
  }
  
  // Step 3: Monitor deployment
  console.log('\nStep 3: Monitoring deployment...');
  let status = 'build_in_progress';
  let attempts = 0;
  
  while (attempts < 30 && !['live', 'build_failed', 'update_failed'].includes(status)) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    status = await checkDeploymentStatus(deployId);
    process.stdout.write(`\rStatus: ${status} (${attempts * 10}s)`);
    attempts++;
  }
  
  console.log('\n');
  
  if (status === 'live') {
    console.log('✅ Deployment successful!');
    
    // Test the deployment
    console.log('\nTesting deployment...');
    const https = require('https');
    
    setTimeout(() => {
      https.get('https://queuemanagement.onrender.com/', (res) => {
        console.log('Root endpoint status:', res.statusCode);
        if (res.statusCode === 200) {
          console.log('✅ App is running!');
        }
      });
      
      https.get('https://queuemanagement.onrender.com/api/health', (res) => {
        console.log('Health endpoint status:', res.statusCode);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('Health response:', data);
          }
        });
      });
    }, 5000);
  } else {
    console.log(`❌ Deployment failed with status: ${status}`);
  }
}

main().catch(console.error);