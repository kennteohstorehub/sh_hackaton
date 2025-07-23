// Emergency session configuration fix for production
// This file ensures session cookies work properly with Render's reverse proxy

module.exports = {
  name: 'qms_session',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Critical for Render
  rolling: true, // Refresh session on activity
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : false, // Critical fix
    path: '/',
    // Don't set domain - let browser handle it
  }
};