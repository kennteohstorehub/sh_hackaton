const http = require('http');
const https = require('https');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  debug: (msg) => console.log(`${colors.magenta}[DEBUG]${colors.reset} ${msg}`)
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:3838';

// First, let's get the CSRF token and session
async function getCSRFToken() {
  return new Promise((resolve, reject) => {
    const url = new URL('/dashboard', BASE_URL);
    const httpModule = url.protocol === 'https:' ? https : http;
    
    httpModule.get(url.toString(), {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract CSRF token from the HTML
        const csrfMatch = data.match(/name="_csrf"\s+value="([^"]+)"/);
        const csrfToken = csrfMatch ? csrfMatch[1] : null;
        
        // Extract session cookie
        const sessionCookie = cookies.find(c => c.includes('qms_session'));
        
        resolve({ csrfToken, sessionCookie });
      });
    }).on('error', reject);
  });
}

// Get queue data
async function getQueueData(sessionCookie) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/queues', BASE_URL);
    const httpModule = url.protocol === 'https:' ? https : http;
    
    httpModule.get(url.toString(), {
      headers: {
        'Cookie': sessionCookie,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const queues = JSON.parse(data);
          resolve(queues);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Test the notify functionality
async function testNotifyCustomer(queueId, customerId, csrfToken, sessionCookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/queue/${queueId}/call-specific`, BASE_URL);
    const httpModule = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify({ customerId });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken
      }
    };
    
    log.debug(`Making POST request to ${url.toString()}`);
    log.debug(`Headers: ${JSON.stringify(options.headers, null, 2)}`);
    log.debug(`Body: ${postData}`);
    
    const req = httpModule.request(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log.debug(`Response status: ${res.statusCode}`);
        log.debug(`Response headers: ${JSON.stringify(res.headers, null, 2)}`);
        log.debug(`Response body: ${data}`);
        
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    log.info('Starting notification error test...');
    
    // Step 1: Get CSRF token and session
    log.info('Getting CSRF token and session...');
    const { csrfToken, sessionCookie } = await getCSRFToken();
    
    if (!sessionCookie) {
      log.error('No session cookie received');
      return;
    }
    
    log.success(`Session cookie: ${sessionCookie.split(';')[0]}`);
    log.success(`CSRF token: ${csrfToken || 'DISABLED'}`);
    
    // Step 2: Get queue data
    log.info('Fetching queue data...');
    const queuesResponse = await getQueueData(sessionCookie);
    log.debug(`Queues response: ${JSON.stringify(queuesResponse, null, 2)}`);
    
    const queues = queuesResponse.queues || queuesResponse;
    const activeQueue = queues.find(q => q.isActive);
    if (!activeQueue) {
      log.error('No active queue found');
      return;
    }
    
    const queueId = activeQueue.id || activeQueue._id;
    log.success(`Found active queue: ${activeQueue.name} (ID: ${queueId})`);
    
    // Find a waiting customer
    const waitingCustomer = activeQueue.entries.find(e => e.status === 'waiting');
    if (!waitingCustomer) {
      log.error('No waiting customers found');
      return;
    }
    
    const customerId = waitingCustomer.id || waitingCustomer._id || waitingCustomer.customerId;
    log.success(`Found waiting customer: ${waitingCustomer.customerName} (ID: ${customerId})`);
    log.debug(`Customer details: ${JSON.stringify(waitingCustomer, null, 2)}`);
    
    // Step 3: Test notify functionality
    log.info('Testing notify customer functionality...');
    
    try {
      const result = await testNotifyCustomer(queueId, customerId, csrfToken, sessionCookie);
      log.success('Notification sent successfully!');
      log.debug(`Result: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      log.error(`Notification failed: ${error.message}`);
      log.debug(`Full error: ${error.stack}`);
    }
    
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    log.debug(error.stack);
  }
}

main();