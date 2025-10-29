/**
 * PM2 ecosystem file example. Copy this to production and fill the BOT_TOKEN and other env vars.
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 */
module.exports = {
  "apps": [
    {
      "name": "trashbin-scheduler-bot",
      "script": "./trashbin-day-handler.js",
      "cwd": "/Users/danilo/GitHub/trashbin-scheduler-bot-tg",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_restarts": 10,
      "env": {
        "NODE_ENV": "production",
        "BOT_TOKEN": "8442580531:AAHzgUxXCxWNif9K_mA3dT8kxgyR9LCeXXE",
        "TARGET_CHAT_ID": "7328814364",
        "ADMIN_CHAT_ID": "7328814364",
        "SEND_TO_SUBSCRIBERS": "false",
        "WRITE_REQUESTS_LOG": "false"
      }
    }
  ]
};