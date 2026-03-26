/**
 * PM2 ecosystem file for production.
 * Run from project root: pm2 start backend/ecosystem.config.cjs
 * Or from backend/: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'smart-question-api',
      cwd: __dirname,
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
