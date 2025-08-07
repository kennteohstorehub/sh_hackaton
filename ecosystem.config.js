module.exports = {
  apps: [{
    name: 'storehub-qms',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3838
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true,
    
    // Restart policies
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Graceful shutdown
    kill_timeout: 5000,
    
    // Auto-restart on file changes (for development)
    ignore_watch: ['node_modules', 'logs', '.git', 'sessions', 'uploads'],
    
    // Crash handling
    autorestart: true,
    exp_backoff_restart_delay: 100
  }]
};