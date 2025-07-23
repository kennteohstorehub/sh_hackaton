const express = require('express');
const app = express();

const PORT = process.env.PORT || 3001;

// Super simple health check - no dependencies
app.get('/test', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PORT: PORT,
      hasJWT: !!process.env.JWT_SECRET,
      hasSession: !!process.env.SESSION_SECRET,
      hasDB: !!process.env.DATABASE_URL
    }
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/test`);
});