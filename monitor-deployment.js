const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';
const DEPLOY_ID = 'dep-d2bcpeer433s739lnieg';

function checkDeploymentStatus() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: `/v1/services/${SERVICE_ID}/deploys/${DEPLOY_ID}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const deploy = JSON.parse(data);
          resolve(deploy);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function monitorDeployment() {
  console.log('🚀 Monitoring deployment...\n');
  
  let status = 'build_in_progress';
  let attempts = 0;
  const maxAttempts = 60; // 10 minutes max
  
  while (status !== 'live' && status !== 'deactivated' && attempts < maxAttempts) {
    try {
      const deploy = await checkDeploymentStatus();
      status = deploy.status;
      
      const statusEmoji = {
        'build_in_progress': '🔨',
        'update_in_progress': '📦',
        'live': '✅',
        'build_failed': '❌',
        'update_failed': '❌',
        'canceled': '🚫',
        'deactivated': '⚠️'
      };
      
      console.log(`${statusEmoji[status] || '❓'} Status: ${status}`);
      
      if (status === 'live') {
        console.log('\n🎉 Deployment successful!');
        console.log('\n📋 Your app is now live at:');
        console.log('   Landing: https://storehub-qms.onrender.com');
        console.log('   Register: https://storehub-qms.onrender.com/register');
        console.log('   Demo 1: https://storehub-qms.onrender.com/t/demo1/auth/login');
        console.log('   Demo 2: https://storehub-qms.onrender.com/t/demo2/auth/login');
        console.log('   BackOffice: https://storehub-qms.onrender.com/backoffice/login');
        console.log('\n⚠️  Note: First request may be slow (cold start)');
        break;
      } else if (status.includes('failed')) {
        console.log('\n❌ Deployment failed!');
        console.log('Check logs at: https://dashboard.render.com/web/srv-d1vojdumcj7s73fjgd6g/logs');
        break;
      }
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    } catch (error) {
      console.error('Error checking status:', error.message);
      break;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⏰ Timeout waiting for deployment');
    console.log('Check status at: https://dashboard.render.com/web/srv-d1vojdumcj7s73fjgd6g');
  }
}

// Run the monitor
monitorDeployment().catch(console.error);