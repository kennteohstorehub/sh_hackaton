const express = require('express');
const router = express.Router();

// AUTH BYPASS: Redirect all auth routes to dashboard
router.get('/login', (req, res) => {
  res.redirect('/dashboard');
});

router.post('/login', (req, res) => {
  res.redirect('/dashboard');
});

router.get('/register', (req, res) => {
  res.redirect('/dashboard');
});

router.post('/register', (req, res) => {
  res.redirect('/dashboard');
});

router.get('/logout', (req, res) => {
  // Properly destroy session before redirecting
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

router.post('/logout', (req, res) => {
  // Properly destroy session before redirecting
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;