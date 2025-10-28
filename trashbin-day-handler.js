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

// store last active chat id as fallback for scheduled messages
let lastActiveChatId = null;

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
  lastActiveChatId = chatId;

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

// --- scheduling logic: send daily at 20:30 local time ---
const parseTargetChats = () => {
  const env = process.env.TARGET_CHAT_ID || '';
  if (!env) return [];
  return env.split(',').map(s => s.trim()).filter(Boolean);
};

const composeMessageForDate = (schedule, dateObj) => {
  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  const mm = pad(dateObj.getMonth() + 1);
  const dd = pad(dateObj.getDate());
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const item = schedule.find((d) => d.date === dateStr);
  const type = item ? item.type : 'UNKNOWN';
  return { dateStr, type };
};

const sendDailyMessage = () => {
  const fs = require('fs');
  const path = require('path');
  let schedule = [];
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'db', 'november-25.json'), 'utf8');
    schedule = JSON.parse(raw);
  } catch (e) {
    console.error('Could not load schedule JSON for scheduled send:', e.message);
    return;
  }

  const now = new Date();
  const today = composeMessageForDate(schedule, now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = composeMessageForDate(schedule, tomorrowDate);

  const outMsg = `Today is ${today.dateStr} (${today.type}). Tomorrow you must put outside ${tomorrow.type}`;

  const targets = parseTargetChats();
  if (targets.length === 0) {
    if (lastActiveChatId) {
      bot.sendMessage(lastActiveChatId, outMsg).catch((err) => console.error('Scheduled send error:', err.message));
      console.log(`Scheduled message sent to last active chat ${lastActiveChatId}: ${outMsg}`);
    } else {
      console.warn('No TARGET_CHAT_ID configured and no last active chat available. Skipping scheduled send.');
    }
    return;
  }

  targets.forEach(t => {
    bot.sendMessage(t, outMsg).catch((err) => console.error('Scheduled send error to', t, err.message));
    console.log(`Scheduled message sent to ${t}: ${outMsg}`);
  });
};

const scheduleNextRun = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(20, 30, 0, 0); // 20:30:00.000 local
  if (next <= now) {
    // if already past today 20:30, schedule for tomorrow
    next.setDate(next.getDate() + 1);
  }
  const msUntilNext = next - now;
  console.log('Scheduling next daily send at', next.toString());
  setTimeout(() => {
    try {
      sendDailyMessage();
    } catch (e) {
      console.error('Error during scheduled send:', e.message);
    }
    // after running, schedule subsequent runs every 24h using scheduleNextRun
    scheduleNextRun();
  }, msUntilNext);
};

// start scheduler
scheduleNextRun();

// send startup notification to configured TARGET_CHAT_ID(s)
const sendStartupNotification = () => {
  const targets = parseTargetChats();
  if (targets.length === 0) {
    console.log('No TARGET_CHAT_ID configured; skipping startup notification.');
    return;
  }
  try {
    const fs = require('fs');
    const path = require('path');
    const raw = fs.readFileSync(path.join(__dirname, 'db', 'november-25.json'), 'utf8');
    const schedule = JSON.parse(raw);
    const now = new Date();
    const today = composeMessageForDate(schedule, now);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = composeMessageForDate(schedule, tomorrowDate);
    const welcome = 'Bot is up';
    // const outMsg = `(startup) Today is ${today.dateStr} (${today.type}). Tomorrow you must put outside ${tomorrow.type}`;
    targets.forEach(t => {
      bot.sendMessage(t, welcome).catch((err) => console.error('Startup welcome send error to', t, err.message));
      // bot.sendMessage(t, outMsg).catch((err) => console.error('Startup send error to', t, err.message));
      console.log(`Startup notification sent to ${t}: ${welcome}`); // ;  ${outMsg}
    });
  } catch (e) {
    console.error('Error sending startup notification:', e.message);
  }
};

sendStartupNotification();
