#!/usr/bin/env node

/**
 * Check all static resources for accessibility
 */

const axios = require('axios');

const BASE_URL = 'http://admin.lvh.me:3838';

// Common static resources that might be referenced
const RESOURCES_TO_CHECK = [
  '/css/main.css',
  '/css/dashboard.css',
  '/css/framework.css',
  '/js/main.js',
  '/js/chatbot.js',
  '/js/queue-chat.js',
  '/js/dashboard.js',
  '/favicon.ico',
  '/manifest.json',
  '/images/logo.png',
  '/fonts/inter.woff2'
];

async function checkResource(path) {
  try {
    const response = await axios.head(`${BASE_URL}${path}`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    return {
      path,
      status: response.status,
      contentType: response.headers['content-type'],
      success: response.status === 200
    };
  } catch (error) {
    return {
      path,
      status: 'ERROR',
      error: error.message,
      success: false
    };
  }
}

async function checkAllResources() {
  console.log('🔍 Checking static resource accessibility...\n');
  
  const results = await Promise.all(
    RESOURCES_TO_CHECK.map(checkResource)
  );
  
  console.log('📊 Results:');
  console.log('===========');
  
  const successful = [];
  const failed = [];
  
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.path} - ${result.status} (${result.contentType})`);
      successful.push(result);
    } else {
      console.log(`❌ ${result.path} - ${result.status} ${result.error ? `(${result.error})` : ''}`);
      failed.push(result);
    }
  }
  
  console.log(`\n📈 Summary: ${successful.length} successful, ${failed.length} failed`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed resources:');
    failed.forEach(f => console.log(`   ${f.path}`));
  }
  
  return { successful, failed };
}

if (require.main === module) {
  checkAllResources()
    .then(results => {
      process.exit(results.failed.length === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { checkAllResources };