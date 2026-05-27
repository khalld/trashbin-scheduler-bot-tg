/**
 * PM2 process file.
 *
 * Secrets and configuration are NOT stored here. They are read from a local
 * `.env` file (gitignored) by `dotenv` at startup — see `.env.example`.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart trashbin-bot
 *   pm2 logs trashbin-bot
 */
module.exports = {
  apps: [
    {
      name: 'trashbin-bot',
      script: './trashbin-day-handler.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '120M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
