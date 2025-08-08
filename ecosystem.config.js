module.exports = {
  apps: [
    {
      name: 'meeting-scheduler-pro',
      script: './src/app.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced PM2 features
      watch: false, // Set to true for development
      ignore_watch: ['node_modules', 'logs', 'public'],
      watch_options: {
        followSymlinks: false
      },
      
      // Resource limits
      max_memory_restart: '1G',
      
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Environment variables
      env_file: '.env',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // Source map support
      source_map_support: true,
      
      // Monitoring
      pmx: true,
      
      // Advanced options
      merge_logs: true,
      combine_logs: true,
      
      // Deployment options
      post_update: ['npm install', 'npm run build'],
      
      // Health check
      health_check_grace_period: 3000
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/meeting-scheduler.git',
      path: '/var/www/meeting-scheduler',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'apt update && apt install git -y'
    },
    staging: {
      user: 'deploy',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/meeting-scheduler.git',
      path: '/var/www/meeting-scheduler-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging && pm2 save'
    }
  }
};
