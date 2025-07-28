#!/usr/bin/env node

const http = require('http');

const data = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 3838,
  path: '/api/queue/14b6e77c-c11d-44c7-8d32-34cd01d67899/call-next',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      console.log('Response customer status:', response.customer?.status);
      console.log('Response customer calledAt:', response.customer?.calledAt);
      console.log('Full customer:', JSON.stringify(response.customer, null, 2));
    } catch (e) {
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();