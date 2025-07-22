#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate cryptographically secure secrets for the application
 */

console.log('🔐 Generating secure secrets for StoreHub Queue Management System\n');

// Generate secrets
const jwtSecret = crypto.randomBytes(32).toString('base64');
const sessionSecret = crypto.randomBytes(32).toString('base64');
const webhookSecret = crypto.randomBytes(32).toString('hex');

console.log('Generated secrets:');
console.log('==================');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`WEBHOOK_SECRET=${webhookSecret}`);
console.log('');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('⚠️  WARNING: .env file already exists.');
  console.log('');
  console.log('To update your .env file with these secrets:');
  console.log('1. Open .env in your editor');
  console.log('2. Replace the placeholder values with the generated secrets above');
  console.log('3. Keep these secrets secure and never commit them to version control');
} else {
  console.log('📝 Creating .env file from .env.example...');
  
  const examplePath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(examplePath)) {
    let envContent = fs.readFileSync(examplePath, 'utf8');
    
    // Replace placeholders with generated secrets
    envContent = envContent.replace('your-jwt-secret-here-min-32-chars', jwtSecret);
    envContent = envContent.replace('your-session-secret-here-min-32-chars', sessionSecret);
    
    // Add webhook secret if not present
    if (!envContent.includes('WEBHOOK_SECRET')) {
      envContent += `\n# Webhook Security\nWEBHOOK_SECRET=${webhookSecret}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created with secure secrets!');
  } else {
    console.log('❌ .env.example not found. Please create it first.');
  }
}

console.log('\n🔒 Security Reminders:');
console.log('- Never commit .env to version control');
console.log('- Use different secrets for each environment');
console.log('- Rotate secrets periodically');
console.log('- Store production secrets in a secure vault');
console.log('- Enable WHATSAPP_ENFORCE_WHITELIST=true in development');