const express = require('express');
const router = express.Router();

// Test endpoint to check which CSRF middleware is loaded
router.get('/which-csrf', (req, res) => {
  const middlewarePath = require.resolve('../middleware/csrf-disabled');
  res.json({
    message: 'Checking which CSRF middleware is loaded',
    loadedMiddleware: middlewarePath,
    csrfTokenInLocals: res.locals.csrfToken || 'none',
    csrfTokenInSession: req.session?.csrfToken || 'none',
    sessionExists: !!req.session
  });
});

// Test POST without CSRF
router.post('/test-post', (req, res) => {
  res.json({
    success: true,
    message: 'POST request successful without CSRF',
    body: req.body
  });
});

module.exports = router;