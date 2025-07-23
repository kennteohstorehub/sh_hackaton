#!/usr/bin/env node

const https = require('https');

// Neon API configuration
const NEON_API_KEY = 'napi_a8k306viawl2w0cxcsd2dom036rhiryyvg9nd7j9sw3nua4yuzxuti2mkb31s4x5';
const NEON_API_BASE = 'https://console.neon.tech/api/v2';

/**
 * Make a request to the Neon API
 */
function neonApiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'console.neon.tech',
      path: `/api/v2${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error: ${res.statusCode} - ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Get user info to find organization ID
 */
async function getUserInfo() {
  try {
    const response = await neonApiRequest('GET', '/users/me');
    return response;
  } catch (error) {
    console.error('Failed to get user info:', error.message);
    throw error;
  }
}

/**
 * Get projects from Neon API
 */
async function getProjects() {
  try {
    // The API key format suggests this might be a project-specific key
    // Let's try to extract project info from the key or find another way
    
    // Try different approaches
    const attempts = [
      { path: '/projects', desc: 'Direct projects list' },
      { path: '/projects?limit=100', desc: 'Projects with limit' },
      { path: '/user/projects', desc: 'User projects' },
    ];

    for (const attempt of attempts) {
      try {
        console.log(`Trying: ${attempt.desc}...`);
        const response = await neonApiRequest('GET', attempt.path);
        if (response.projects) {
          return response.projects;
        }
        // If response is an array, it might be the projects directly
        if (Array.isArray(response)) {
          return response;
        }
      } catch (error) {
        console.log(`  Failed: ${error.message.split('\n')[0]}`);
      }
    }

    // If all attempts fail, let's try to check if this is a project-scoped API key
    console.log('\nChecking if this is a project-scoped API key...');
    
    // API keys that start with 'napi_' might be project-scoped
    // Let's try to decode or use it differently
    throw new Error('Could not retrieve projects. The API key might be project-scoped or requires additional parameters.');
    
  } catch (error) {
    console.error('Failed to get projects:', error.message);
    throw error;
  }
}

/**
 * Get database details for a project
 */
async function getDatabases(projectId) {
  try {
    const response = await neonApiRequest('GET', `/projects/${projectId}/databases`);
    return response.databases || [];
  } catch (error) {
    console.error('Failed to get databases:', error.message);
    throw error;
  }
}

/**
 * Get connection details for a project
 */
async function getConnectionUri(projectId) {
  try {
    const response = await neonApiRequest('GET', `/projects/${projectId}/connection_uri`);
    return response.uri;
  } catch (error) {
    console.error('Failed to get connection URI:', error.message);
    throw error;
  }
}

/**
 * Main function to check Neon database
 */
async function main() {
  console.log('🔍 Checking Neon database configuration...\n');

  try {
    // Step 1: List all projects
    console.log('📋 Fetching Neon projects...');
    const projects = await getProjects();
    
    if (projects.length === 0) {
      console.log('❌ No projects found in Neon account');
      return;
    }

    console.log(`\n✅ Found ${projects.length} project(s):\n`);
    
    for (const project of projects) {
      console.log(`Project: ${project.name}`);
      console.log(`  ID: ${project.id}`);
      console.log(`  Region: ${project.region_id}`);
      console.log(`  Created: ${new Date(project.created_at).toLocaleDateString()}`);
      console.log(`  Status: ${project.provisioner === 'ready' ? '🟢 Ready' : '🟡 ' + project.provisioner}`);
      
      // Get databases for this project
      try {
        const databases = await getDatabases(project.id);
        console.log(`  Databases: ${databases.map(db => db.name).join(', ')}`);
      } catch (err) {
        console.log(`  Databases: Error fetching - ${err.message}`);
      }

      // Get connection string (without password)
      try {
        const uri = await getConnectionUri(project.id);
        // Mask the password in the connection string
        const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
        console.log(`  Connection: ${maskedUri}`);
      } catch (err) {
        console.log(`  Connection: Error fetching - ${err.message}`);
      }

      console.log('');
    }

    // Step 2: Check for Queue Management System project
    const queueProject = projects.find(p => 
      p.name.toLowerCase().includes('queue') || 
      p.name.toLowerCase().includes('hack') ||
      p.name.toLowerCase().includes('storehub')
    );

    if (queueProject) {
      console.log(`\n🎯 Found potential Queue Management System project: "${queueProject.name}"`);
      console.log('\nTo check the session table, you would need to:');
      console.log('1. Use the connection string from above to connect to the database');
      console.log('2. Query the "Session" table to see its structure and data');
      console.log('\nExample queries to run:');
      console.log('  - SELECT COUNT(*) FROM "Session";');
      console.log('  - SELECT * FROM "Session" ORDER BY "expiresAt" DESC LIMIT 10;');
      console.log('  - SELECT * FROM "Session" WHERE "expiresAt" > NOW();');
    } else {
      console.log('\n⚠️  Could not identify Queue Management System project');
      console.log('Please check which project corresponds to your Queue Management System');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('401')) {
      console.error('Authentication failed. Please check the API key.');
    }
  }
}

// Run the script
main().catch(console.error);