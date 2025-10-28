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

  // compute today's and tomorrow's date strings in local YYYY-MM-DD using local date parts
  const pad = (n) => n.toString().padStart(2, '0');
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tyyyy = tomorrowDate.getFullYear();
  const tmm = pad(tomorrowDate.getMonth() + 1);
  const tdd = pad(tomorrowDate.getDate());
  const tomorrowStr = `${tyyyy}-${tmm}-${tdd}`;

  // load schedule from db/november-25.json using fs to avoid require cache issues
  const fs = require('fs');
  let schedule = [];
  try {
    const raw = fs.readFileSync(require('path').join(__dirname, 'db', 'november-25.json'), 'utf8');
    schedule = JSON.parse(raw);
  } catch (e) {
    console.error('Could not load schedule JSON:', e.message);
  }

  const findType = (dateStr) => {
    const item = schedule.find((d) => d.date === dateStr);
    return item ? item.type : 'UNKNOWN';
  };

  const todayType = findType(todayStr);
  const tomorrowType = findType(tomorrowStr);

  // diagnostic logs
  console.log('Today:', todayStr, '->', todayType);
  console.log('Tomorrow:', tomorrowStr, '->', tomorrowType);

  const outMsg = `Today is ${todayStr} (${todayType}). Tomorrow you must put outside ${tomorrowType}`;
  bot.sendMessage(chatId, outMsg).catch((err) => console.error('Send error:', err.message));
  console.log(`Sent to ${chatId}: ${outMsg}`);

});
