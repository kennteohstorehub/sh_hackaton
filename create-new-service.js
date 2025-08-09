const https = require('https');
const crypto = require('crypto');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';

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

async function createNewService() {
  console.log('🚀 Creating New Render Web Service');
  console.log('=' .repeat(60));
  
  try {
    // Check owner ID first
    console.log('\n📋 Getting owner information...');
    const servicesResp = await makeRequest('/v1/services?limit=1');
    
    let ownerId = 'tea-cvkdadvgi27c73bjjhag'; // Default from existing service
    
    if (servicesResp.data && servicesResp.data.length > 0) {
      ownerId = servicesResp.data[0].service.ownerId;
      console.log('Owner ID:', ownerId);
    }
    
    // Create new service
    console.log('\n🔧 Creating new web service...');
    
    const newService = {
      type: 'web_service',
      name: 'storehub-qms-fixed',
      ownerId: ownerId,
      repo: 'https://github.com/kennteohstorehub/sh_hackaton',
      autoDeploy: 'yes',
      branch: 'main',
      buildFilter: {
        paths: [],
        ignoredPaths: []
      },
      rootDir: '',
      serviceDetails: {
        buildCommand: 'npm install && npx prisma generate',
        startCommand: 'npm start',
        env: 'node',
        region: 'singapore',
        plan: 'starter',
        numInstances: 1,
        healthCheckPath: '',
        envVars: [
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
        ]
      }
    };
    
    const createResp = await makeRequest('/v1/services', 'POST', newService);
    
    console.log('Create response status:', createResp.status);
    
    if (createResp.status === 201 || createResp.status === 200) {
      const service = createResp.data;
      console.log('✅ New service created!');
      console.log('Service ID:', service.service?.id || service.id);
      console.log('Service URL:', `https://${service.service?.name || service.name}.onrender.com`);
      console.log('Dashboard:', service.service?.dashboardUrl || `https://dashboard.render.com/web/${service.id}`);
      
      console.log('\n⏳ Service is being deployed...');
      console.log('This will take 5-10 minutes for the first deployment.');
      console.log('\nOnce deployed, access your app at:');
      console.log(`  https://${service.service?.name || service.name}.onrender.com`);
      
      return service.service?.id || service.id;
    } else {
      console.log('❌ Failed to create service');
      console.log('Response:', createResp.data);
      
      if (createResp.data && typeof createResp.data === 'string' && createResp.data.includes('quota')) {
        console.log('\n⚠️  You may have reached your service limit on the free plan.');
        console.log('Consider deleting the non-working service first.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Alternative: List all services to find the issue
async function listServices() {
  console.log('\n📋 Listing all services...');
  const resp = await makeRequest('/v1/services');
  
  if (resp.data) {
    console.log(`Found ${resp.data.length} services:`);
    resp.data.forEach(item => {
      const s = item.service;
      console.log(`  - ${s.name} (${s.id})`);
      console.log(`    Type: ${s.type}`);
      console.log(`    Status: ${s.suspended || 'active'}`);
      console.log(`    URL: https://${s.name}.onrender.com`);
    });
  }
}

async function main() {
  // First list existing services
  await listServices();
  
  // Ask if we should create new service
  console.log('\n❓ The existing service is misconfigured.');
  console.log('Creating a new service is the best solution.');
  
  // Create new service
  const newServiceId = await createNewService();
  
  if (newServiceId) {
    console.log('\n✅ Next steps:');
    console.log('1. Wait for deployment to complete (5-10 minutes)');
    console.log('2. Test the new service');
    console.log('3. Delete the old broken service if new one works');
  }
}

main().catch(console.error);