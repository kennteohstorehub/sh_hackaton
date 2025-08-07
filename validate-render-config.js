#!/usr/bin/env node

/**
 * Render.com Configuration Validator
 * Validates that the application is ready for Render deployment
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('🚀 Validating Render.com Configuration...\n');

const issues = [];
const warnings = [];

// Check for render.yaml
function checkRenderYaml() {
  const renderYamlPath = path.join(__dirname, 'render.yaml');
  
  if (!fs.existsSync(renderYamlPath)) {
    // Create a default render.yaml
    const defaultConfig = `services:
  - type: web
    name: storehub-qms
    env: node
    region: oregon
    plan: standard
    buildCommand: npm install && npx prisma generate && npx prisma migrate deploy
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: BASE_DOMAIN
        value: storehubqms.com
      - key: SUPERADMIN_DOMAIN
        value: admin.storehubqms.com
      - key: DATABASE_URL
        fromDatabase:
          name: storehub-qms-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true
      - key: RENDER_API_KEY
        sync: false
      - key: RENDER_SERVICE_ID
        sync: false
      - key: EMAIL_PROVIDER
        value: console
      - key: EMAIL_FROM
        value: noreply@storehubqms.com

databases:
  - name: storehub-qms-db
    databaseName: storehub_qms
    user: storehub_qms
    region: oregon
    plan: standard
`;
    
    fs.writeFileSync(renderYamlPath, defaultConfig);
    console.log('✅ Created render.yaml with default configuration');
  } else {
    console.log('✅ render.yaml exists');
    
    // Validate the content
    try {
      const config = yaml.load(fs.readFileSync(renderYamlPath, 'utf8'));
      
      if (!config.services || config.services.length === 0) {
        issues.push('render.yaml: No services defined');
      }
      
      if (!config.databases || config.databases.length === 0) {
        warnings.push('render.yaml: No database defined - will need external database');
      }
    } catch (e) {
      issues.push(`render.yaml: Invalid YAML - ${e.message}`);
    }
  }
}

// Check package.json scripts
function checkPackageJson() {
  const packagePath = path.join(__dirname, 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    issues.push('package.json not found');
    return;
  }
  
  const package = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Check required scripts
  const requiredScripts = ['start', 'build'];
  for (const script of requiredScripts) {
    if (!package.scripts || !package.scripts[script]) {
      warnings.push(`package.json: Missing "${script}" script`);
    }
  }
  
  // Check Node version
  if (package.engines && package.engines.node) {
    console.log(`✅ Node version specified: ${package.engines.node}`);
  } else {
    warnings.push('package.json: No Node.js version specified in engines');
  }
}

// Check for environment configuration
function checkEnvironment() {
  // Check for .env.example
  if (!fs.existsSync('.env.example')) {
    const envExample = `# Render.com Environment Variables

# Application
NODE_ENV=production
PORT=10000
BASE_DOMAIN=storehubqms.com
SUPERADMIN_DOMAIN=admin.storehubqms.com

# Database (provided by Render)
# DATABASE_URL will be automatically set

# Session
SESSION_SECRET=generate-a-secure-random-string

# Render API (for subdomain provisioning)
RENDER_API_KEY=your-render-api-key
RENDER_SERVICE_ID=srv-your-service-id

# Email
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@storehubqms.com

# Optional: Production email provider
# EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=your-sendgrid-key
`;
    
    fs.writeFileSync('.env.example', envExample);
    console.log('✅ Created .env.example for Render deployment');
  } else {
    console.log('✅ .env.example exists');
  }
}

// Check for health endpoint
function checkHealthEndpoint() {
  const indexPath = path.join(__dirname, 'server/index.js');
  
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    if (content.includes('/api/health')) {
      console.log('✅ Health check endpoint exists');
    } else {
      warnings.push('No health check endpoint found at /api/health');
    }
  }
}

// Check for Prisma
function checkPrisma() {
  if (!fs.existsSync('prisma/schema.prisma')) {
    issues.push('Prisma schema not found');
    return;
  }
  
  console.log('✅ Prisma schema found');
  
  // Check for migrations
  if (!fs.existsSync('prisma/migrations')) {
    warnings.push('No Prisma migrations found - run "npx prisma migrate dev" first');
  }
}

// Check subdomain configuration
function checkSubdomainSupport() {
  console.log('\n📌 Subdomain Configuration:');
  console.log('   After deployment, configure DNS:');
  console.log('   1. Add CNAME record: *.storehubqms.com -> your-app.onrender.com');
  console.log('   2. Add custom domain in Render dashboard');
  console.log('   3. Enable wildcard SSL certificate');
}

// Run all checks
checkRenderYaml();
checkPackageJson();
checkEnvironment();
checkHealthEndpoint();
checkPrisma();

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Validation Summary:');

if (issues.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! Ready for Render deployment.');
} else {
  if (issues.length > 0) {
    console.log('\n❌ Issues (must fix):');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings (should fix):');
    warnings.forEach(warning => console.log(`   - ${warning}`));
  }
}

checkSubdomainSupport();

console.log('\n📚 Deployment Steps:');
console.log('1. Push code to GitHub');
console.log('2. Create new Web Service on Render');
console.log('3. Connect GitHub repository');
console.log('4. Render will use render.yaml automatically');
console.log('5. Set environment variables in Render dashboard');
console.log('6. Configure custom domains for subdomains');
console.log('\nFor detailed instructions, see LOCAL_SUBDOMAIN_TESTING_GUIDE.md');