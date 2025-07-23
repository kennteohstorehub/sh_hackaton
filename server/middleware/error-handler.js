
// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR] Unhandled error:', err.message);
  console.error('[ERROR] Stack:', err.stack);
  console.error('[ERROR] URL:', req.url);
  console.error('[ERROR] Method:', req.method);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Check if it's an API request
  const isApi = req.xhr || 
                req.headers['accept']?.includes('application/json') ||
                req.headers['content-type']?.includes('application/json');
  
  if (isApi) {
    res.status(err.status || 500).json({
      error: isDev ? err.message : 'Internal server error',
      ...(isDev && { stack: err.stack })
    });
  } else {
    // For HTML requests, render an error page
    res.status(err.status || 500);
    
    // Try to render error page, fallback to plain text
    try {
      res.render('error', {
        message: isDev ? err.message : 'Something went wrong',
        error: isDev ? err : {}
      });
    } catch (renderErr) {
      console.error('[ERROR] Failed to render error page:', renderErr);
      res.send('Internal Server Error');
    }
  }
};

// Process-level error handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  console.error(err.stack);
  // Give some time to log the error before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  // Convert to exception
  throw reason;
});

module.exports = errorHandler;
