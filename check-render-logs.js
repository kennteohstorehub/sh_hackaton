const https = require('https');

const RENDER_API_KEY = 'rnd_BRJ00qyXje6ArV2pIoJoVGYb1phx';
const SERVICE_ID = 'srv-d1vojdumcj7s73fjgd6g';

function getLogs() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: `/v1/services/${SERVICE_ID}/logs`,
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
        resolve(data);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkLogs() {
  console.log('📋 Fetching Render logs...\n');
  
  try {
    const logs = await getLogs();
    
    // Parse and display logs
    const lines = logs.split('\n');
    
    // Look for error patterns
    const errorLines = lines.filter(line => 
      line.toLowerCase().includes('error') || 
      line.toLowerCase().includes('failed') ||
      line.toLowerCase().includes('cannot') ||
      line.toLowerCase().includes('missing') ||
      line.toLowerCase().includes('crash')
    );
    
    console.log('🔍 Recent Error Messages:');
    console.log('=' .repeat(80));
    errorLines.slice(-20).forEach(line => console.log(line));
    
    console.log('\n📝 Last 30 Log Lines:');
    console.log('=' .repeat(80));
    lines.slice(-30).forEach(line => console.log(line));
    
  } catch (error) {
    console.error('Error fetching logs:', error.message);
  }
}

checkLogs();