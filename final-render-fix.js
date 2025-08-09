const https = require('https');
const crypto = require('crypto');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const OLD_SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

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

async function createWorkingService() {
  console.log('🚀 Creating New Working Render Service');
  console.log('=' .repeat(60));
  
  try {
    console.log('\n🔧 Creating web service with correct configuration...');
    
    const newService = {
      type: 'web_service',
      name: 'storehub-qms-production',
      ownerId: 'tea-cvkdadvgi27c73bjjhag',
      repo: 'https://github.com/kennteohstorehub/sh_hackaton',
      autoDeploy: 'yes',
      branch: 'main',
      serviceDetails: {
        env: 'node',
        region: 'singapore',
        plan: 'starter',
        numInstances: 1,
        envSpecificDetails: {
          buildCommand: 'npm install && npx prisma generate',
          startCommand: 'npm start'
        }
      }
    };
    
    const createResp = await makeRequest('/v1/services', 'POST', newService);
    
    console.log('Create response status:', createResp.status);
    
    if (createResp.status === 201 || createResp.status === 200) {
      const service = createResp.data.service;
      console.log('✅ New service created successfully!');
      console.log('Service ID:', service.id);
      console.log('Service Name:', service.name);
      console.log('Dashboard URL:', service.dashboardUrl);
      
      // Set environment variables
      console.log('\n🔑 Setting environment variables...');
      
      const envVars = [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'PORT', value: '10000' },
        { key: 'JWT_SECRET', value: crypto.randomBytes(32).toString('base64') },
        { key: 'SESSION_SECRET', value: crypto.randomBytes(32).toString('base64') },
        { key: 'DATABASE_URL', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' },
        { key: 'DATABASE_URL_DIRECT', value: 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' },
        { key: 'TRUST_PROXY', value: 'true' },
        { key: 'EMAIL_PROVIDER', value: 'console' },
        { key: 'EMAIL_FROM', value: 'noreply@storehubqms.com' },
        { key: 'WEBHOOK_SECRET', value: crypto.randomBytes(32).toString('base64') }
      ];
      
      const envResp = await makeRequest(`/v1/services/${service.id}/env-vars`, 'PUT', envVars);
      console.log('Environment variables response:', envResp.status);
      
      // The service will auto-deploy from GitHub
      console.log('\n⏳ Service is being deployed...');
      console.log('This will take 5-10 minutes for the first deployment.');
      
      // Monitor the first deployment
      console.log('\n📊 Monitoring initial deployment...');
      
      // Get the latest deploy
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const deploysResp = await makeRequest(`/v1/services/${service.id}/deploys?limit=1`);
      if (deploysResp.data && deploysResp.data.length > 0) {
        const deploy = deploysResp.data[0].deploy;
        console.log('Deploy ID:', deploy.id);
        console.log('Initial status:', deploy.status);
        
        // Monitor until complete
        let status = deploy.status;
        let attempts = 0;
        
        while (attempts < 40 && !['live', 'build_failed', 'update_failed'].includes(status)) {
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          const statusResp = await makeRequest(`/v1/services/${service.id}/deploys/${deploy.id}`);
          if (statusResp.data) {
            status = statusResp.data.status;
            process.stdout.write(`\rStatus: ${status} (${attempts * 15}s elapsed)`);
          }
          attempts++;
        }
        
        console.log('\n');
        
        if (status === 'live') {
          console.log('✅ Deployment successful!');
          
          const serviceUrl = `https://${service.name}.onrender.com`;
          console.log('\n🎉 Your app is now live at:');
          console.log(`  ${serviceUrl}`);
          console.log('\nTest URLs:');
          console.log(`  ${serviceUrl}/register`);
          console.log(`  ${serviceUrl}/backoffice/login`);
          console.log(`  ${serviceUrl}/t/demo1/auth/login`);
          console.log(`  ${serviceUrl}/t/demo2/auth/login`);
          
          // Test the endpoints
          console.log('\n🔍 Testing endpoints...');
          await testService(service.name);
          
        } else {
          console.log(`❌ Deployment failed with status: ${status}`);
          console.log('Check logs at:', service.dashboardUrl + '/logs');
        }
      }
      
      return service.id;
      
    } else {
      console.log('❌ Failed to create service');
      console.log('Response:', createResp.data);
      
      if (createResp.status === 402) {
        console.log('\n⚠️  You have reached your service limit.');
        console.log('You need to delete an existing service first.');
        
        // Offer to delete the broken service
        console.log('\n❓ The old QueueManagement service is not working.');
        console.log('Service ID:', OLD_SERVICE_ID);
        console.log('Consider deleting it at: https://dashboard.render.com/web/' + OLD_SERVICE_ID);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testService(serviceName) {
  const https = require('https');
  const baseUrl = `https://${serviceName}.onrender.com`;
  
  const testEndpoint = (path) => {
    return new Promise((resolve) => {
      https.get(baseUrl + path, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ path, status: res.statusCode, redirect: res.headers.location });
        });
      }).on('error', (err) => {
        resolve({ path, status: 'error', error: err.message });
      });
    });
  };
  
  const endpoints = ['/', '/api/health', '/register', '/backoffice/login'];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    if (result.status === 200) {
      console.log(`  ✅ ${result.path} - Working!`);
    } else if (result.status === 301 || result.status === 302) {
      console.log(`  ↪️  ${result.path} - Redirects to ${result.redirect}`);
    } else if (result.status === 404) {
      console.log(`  ❌ ${result.path} - Not found`);
    } else {
      console.log(`  ⚠️  ${result.path} - Status ${result.status}`);
    }
  }
}

// Run the fix
createWorkingService();