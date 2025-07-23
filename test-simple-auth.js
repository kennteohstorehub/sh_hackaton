// Simple test to bypass session regeneration
const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

app.post('/test-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Testing login for:', email);
    
    // Find merchant using Prisma directly
    const merchant = await prisma.merchant.findFirst({
      where: { email },
      include: {
        settings: true,
        subscription: true,
        integrations: true
      }
    });
    
    if (!merchant) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log('Found merchant:', {
      id: merchant.id,
      email: merchant.email,
      hasSettings: !!merchant.settings,
      hasSubscription: !!merchant.subscription,
      hasIntegrations: !!merchant.integrations
    });
    
    // Check password
    const validPassword = await bcrypt.compare(password, merchant.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Try to access the ID
    const userId = merchant.id || merchant._id?.toString();
    console.log('User ID:', userId);
    
    res.json({
      success: true,
      merchant: {
        id: userId,
        email: merchant.email,
        businessName: merchant.businessName
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

const PORT = 3839;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Test with: curl -X POST http://localhost:3839/test-login -H "Content-Type: application/json" -d \'{"email":"demo@smartqueue.com","password":"demo123456"}\'');
});