const TelegramBot = require('node-telegram-bot-api');
// Load environment variables from .env if present
require('dotenv').config();

// read the Telegram token from environment variable BOT_TOKEN
const token = process.env.BOT_TOKEN;

// Create a bot that uses 'polling' to fetch new updates
if (!token) {
  console.error('Error: BOT_TOKEN is not set. Please add it to .env or set the environment variable BOT_TOKEN');
  process.exit(1);
}

const bot = new TelegramBot(token, {polling: true});

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, resp);
});

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // send a message to the chat acknowledging receipt of their message
  bot.sendMessage(chatId, 'Received your message');
  console.log(msg);

});
