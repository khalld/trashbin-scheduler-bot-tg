/**
 * PM2 ecosystem file example. Copy this to production and fill the BOT_TOKEN and other env vars.
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'trashbin-scheduler-bot',
      script: './trashbin-day-handler.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        // Fill with your bot token (should be kept secret). You can also use a .env file.
        BOT_TOKEN: '',
        // Comma-separated list of chat ids to send startup/scheduled messages to
        TARGET_CHAT_ID: '',
        // Comma-separated list of admin chat ids allowed to run admin commands
        ADMIN_CHAT_ID: '7328814364',
        // When 'true', scheduled messages will be sent to all stored subscribers (db/chats.json)
        SEND_TO_SUBSCRIBERS: 'false',
        // When 'true', append request logs to logs/requests.log in project root
        WRITE_REQUESTS_LOG: 'false'
      }
    }
  ]
};
module.exports = {
  apps: [{
    name: 'trashbin-bot',
    script: './trashbin-day-handler.js',
    cwd: './trashbin-scheduler-bot-tg',
    env: {
      NODE_ENV: 'production',
      TARGET_CHAT_ID: '', // opzionale
      BOT_TOKEN: '8442580531:AAHzgUxXCxWNif9K_mA3dT8kxgyR9LCeXXE'
      // Non mettere BOT_TOKEN qui se preferisci tenerlo in .env
    }
  }]
};