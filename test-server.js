const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Basic logging
console.log('=== TEST SERVER STARTING ===');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV || 'not set',
  PORT: PORT,
  HAS_JWT_SECRET: !!process.env.JWT_SECRET,
  HAS_SESSION_SECRET: !!process.env.SESSION_SECRET,
  HAS_DATABASE_URL: !!process.env.DATABASE_URL
});

// Minimal middleware
app.use(express.json());

// Health check
app.get('/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Test server is running',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      hasRequiredSecrets: !!(process.env.JWT_SECRET && process.env.SESSION_SECRET)
    }
  });
});

// Test error handling
app.get('/test-error', (req, res) => {
  throw new Error('Test error');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error caught:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Try: http://localhost:${PORT}/test`);
});