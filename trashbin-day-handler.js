#!/usr/bin/env node
// load environment variables from .env (BOT_TOKEN, TARGET_CHAT_ID, ...)
require('dotenv').config();
// import shared constants and utils
const { EMOJI_MAP } = require('./lib/constants');
const { parseTargetChats, getEntryForDate, loadScheduleForDate, ensureLogsDir, logRequest, getSubscribers, subscribeChat, unsubscribeChat } = require('./lib/utils');
const TelegramBot = require('node-telegram-bot-api');
// read the Telegram token from environment variable BOT_TOKEN
const token = process.env.BOT_TOKEN;
// Create a bot that uses 'polling' to fetch new updates
if (!token) {
  console.error('Error: BOT_TOKEN is not set. Copy .env.example to .env and set BOT_TOKEN (see README / INSTALL.md).');
  process.exit(1);
}
const bot = new TelegramBot(token, {polling: true});
// store last active chat id as fallback for scheduled messages
let lastActiveChatId = null;

// Listen for any kind of message. There are different kinds of messages.
// NOTE: logs are written to stdout so pm2 can capture them. To also persist logs to file,
// set WRITE_REQUESTS_LOG=true in .env and the logger will append to logs/requests.log.
bot.on('message', (msg) => {
  // Always log the request and auto-subscribe, but don't auto-send the detailed 'today...' message here.
  logRequest(msg, null, __dirname);
  const chatId = msg.chat.id;
  lastActiveChatId = chatId;
  // add to subscribers list (saved into ecosystem.config.js TARGET_CHAT_ID)
  try {
    subscribeChat(String(chatId), __dirname);
  } catch (e) {
    console.error('Failed to subscribe chat:', e.message);
  }
  // any other simple auto-replies can be added here, but the main info message is now sent only on /info
});


// Matches "/echo [whatever]". Logs message, info about the user and echoes back the same message.
bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, resp);
});

// Admin command: /subscribers -> list subscriber chat IDs (restricted for admin) TODO: test with account having different id than admin.
bot.onText(/\/subscribers/, async (msg) => {
  const fromId = msg.from && (msg.from.id || msg.from.username);
  const adminEnv = process.env.ADMIN_CHAT_ID || '';
  const admins = adminEnv.split(',').map(s => s.trim()).filter(Boolean);
  const isAdmin = admins.length === 0 ? false : admins.includes(String(fromId)) || admins.includes(String(msg.chat.id));
  if (!isAdmin) {
    return bot.sendMessage(msg.chat.id, 'Not authorized');
  }
  try {
    const { getSubscribers } = require('./lib/utils');
    const subs = getSubscribers(__dirname);
    if (!subs || subs.length === 0) {
      return bot.sendMessage(msg.chat.id, 'No subscribers yet');
    }
    const body = subs.join('\n');
    bot.sendMessage(msg.chat.id, `Subscribers:\n${body}`);
  } catch (e) {
    console.error('Failed to list subscribers:', e.message);
    bot.sendMessage(msg.chat.id, 'Error reading subscribers');
  }
});

// Command for users to unsubscribe themselves TODO: is not working yet.
bot.onText(/\/unsubscribe/, (msg) => {
  const chatId = msg.chat && msg.chat.id;
  if (!chatId) return;
  try {
    unsubscribeChat(String(chatId), __dirname);
    bot.sendMessage(chatId, 'You have been unsubscribed.');
  } catch (e) {
    console.error('Failed to unsubscribe:', e.message);
    bot.sendMessage(chatId, 'Unable to unsubscribe right now.');
  }
});

// New command: /info -> reply with today's and tomorrow's schedule (same message used by scheduler)
bot.onText(/\/info/, (msg) => {
  const chatId = msg.chat && msg.chat.id;
  if (!chatId) return;

  const now = new Date();
  const today = getEntryForDate(now, __dirname);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getEntryForDate(tomorrowDate, __dirname);

  const emojiToday = EMOJI_MAP[today.type] || EMOJI_MAP.UNKNOWN;
  const emojiTomorrow = EMOJI_MAP[tomorrow.type] || EMOJI_MAP.UNKNOWN;
  const outMsg = `Today is ${today.dateStr} ${emojiToday} (${today.type}). Tonight, after 20:00 you must put outside ${emojiTomorrow} ${tomorrow.type}`;
  bot.sendMessage(chatId, outMsg).catch((err) => console.error('Send /info error:', err.message));
  console.log(`Sent /info to ${chatId}: ${outMsg}`);
});

// /week -> reply with the collection type for each of the next 7 days
bot.onText(/\/week/, (msg) => {
  const chatId = msg.chat && msg.chat.id;
  if (!chatId) return;

  const now = new Date();
  const lines = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const entry = getEntryForDate(d, __dirname);
    const emoji = EMOJI_MAP[entry.type] || EMOJI_MAP.UNKNOWN;
    lines.push(`${entry.dateStr} ${emoji} ${entry.type}`);
  }
  const outMsg = `📆 Next 7 days\n\n${lines.join('\n')}`;
  bot.sendMessage(chatId, outMsg).catch((err) => console.error('Send /week error:', err.message));
  console.log(`Sent /week to ${chatId}`);
});

// /month -> reply with the full schedule for the current month
bot.onText(/\/month/, (msg) => {
  const chatId = msg.chat && msg.chat.id;
  if (!chatId) return;

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const schedule = loadScheduleForDate(now, __dirname);
  if (!schedule.length) {
    return bot.sendMessage(chatId, `No schedule available for ${monthStr}.`);
  }
  const lines = schedule
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const emoji = EMOJI_MAP[e.type] || EMOJI_MAP.UNKNOWN;
      return `${e.date.slice(8, 10)} ${emoji} ${e.type}`;
    });
  const outMsg = `🗓️ Calendar for ${monthStr}\n\n${lines.join('\n')}`;
  bot.sendMessage(chatId, outMsg).catch((err) => console.error('Send /month error:', err.message));
  console.log(`Sent /month to ${chatId} (${lines.length} days)`);
});

// /help (and /start) -> list available commands
bot.onText(/\/(help|start)/, (msg) => {
  const chatId = msg.chat && msg.chat.id;
  if (!chatId) return;

  const outMsg = [
    '🤖 Trashbin Scheduler Bot — available commands:',
    '',
    '/info — today\'s collection + what to put out tonight',
    '/week — schedule for the next 7 days',
    '/month — full calendar for the current month',
    '/unsubscribe — stop receiving the daily message',
    '/echo <text> — echo the text back (debug)'
  ].join('\n');
  bot.sendMessage(chatId, outMsg).catch((err) => console.error('Send /help error:', err.message));
  console.log(`Sent /help to ${chatId}`);
});

// --- scheduling logic: send daily at 20:30 local time ---

const sendDailyMessage = () => {
  const now = new Date();
  const today = getEntryForDate(now, __dirname);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getEntryForDate(tomorrowDate, __dirname);

  const emojiToday = EMOJI_MAP[today.type] || EMOJI_MAP.UNKNOWN;
  const emojiTomorrow = EMOJI_MAP[tomorrow.type] || EMOJI_MAP.UNKNOWN;
  const outMsg = `Today is ${today.dateStr} ${emojiToday} (${today.type}). Tonight, after 20:00 pm you must put outside ${emojiTomorrow} ${tomorrow.type}`;

  // decide targets: env TARGET_CHAT_ID has precedence; if SEND_TO_SUBSCRIBERS=true, use saved subscribers instead
  let targets = parseTargetChats();
  if (process.env.SEND_TO_SUBSCRIBERS === 'true') {
    try {
      const subs = getSubscribers(__dirname);
      targets = subs.map(String);
    } catch (e) {
      console.error('Failed to load subscribers:', e.message);
    }
  }

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

// send startup notification to configured TARGET_CHAT_ID(s)
const sendStartupNotification = () => {
  const targets = parseTargetChats();
  if (targets.length === 0) {
    console.log('No TARGET_CHAT_ID configured; skipping startup notification.');
    return;
  }
  try {
    const now = new Date();
    const today = getEntryForDate(now, __dirname);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = getEntryForDate(tomorrowDate, __dirname);
    const rocket = '🚀';
    const welcome = `${rocket} Bot is up`;
    const emojiToday = EMOJI_MAP[today.type] || EMOJI_MAP.UNKNOWN;
    const emojiTomorrow = EMOJI_MAP[tomorrow.type] || EMOJI_MAP.UNKNOWN;
    const outMsg = `(startup) Today is ${today.dateStr} ${emojiToday} (${today.type}). Tomorrow you must put outside ${emojiTomorrow} ${tomorrow.type}`;
    targets.forEach(t => {
      bot.sendMessage(t, welcome).catch((err) => console.error('Startup welcome send error to', t, err.message));
      bot.sendMessage(t, outMsg).catch((err) => console.error('Startup send error to', t, err.message));
      console.log(`Startup notification sent to ${t}: ${welcome}; ${outMsg}`);
    });
  } catch (e) {
    console.error('Error sending startup notification:', e.message);
  }
};

// register the command list so it shows in Telegram's UI menu
bot.setMyCommands([
  { command: 'info', description: "Today's collection + what to put out tonight" },
  { command: 'week', description: 'Schedule for the next 7 days' },
  { command: 'month', description: 'Full calendar for the current month' },
  { command: 'help', description: 'List available commands' },
  { command: 'unsubscribe', description: 'Stop receiving the daily message' }
]).catch((err) => console.error('setMyCommands error:', err.message));

// start scheduler
scheduleNextRun();
sendStartupNotification();
