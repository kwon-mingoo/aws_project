module.exports = {
  apps: [
    {
      name: 'aws2-giot-backend',
      script: '/home/ec2-user/app/aws2-api/dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      cwd: '/home/ec2-user/app/aws2-api',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_file: '/var/log/aws2-giot-app/backend.log',
      out_file: '/var/log/aws2-giot-app/backend-out.log',
      error_file: '/var/log/aws2-giot-app/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'aws2-giot-frontend',
      script: 'npx',
      args: `serve -s build -l ${process.env.PORT || 3002}`,
      cwd: '/home/ec2-user/app/frontend_backup',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_file: '/var/log/aws2-giot-app/frontend.log',
      out_file: '/var/log/aws2-giot-app/frontend-out.log',
      error_file: '/var/log/aws2-giot-app/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 2000,
      max_restarts: 5,
      min_uptime: '10s'
    }
  ],

  deploy: {
    production: {
      user: 'ec2-user',
      host: 'your-ec2-instance-ip',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/aws2-giot-app.git',
      path: '/opt/aws2-giot-app',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};