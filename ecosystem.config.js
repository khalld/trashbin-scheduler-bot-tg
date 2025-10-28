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