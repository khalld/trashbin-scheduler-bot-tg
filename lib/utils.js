const fs = require('fs');
const path = require('path');

const parseTargetChats = (envStr) => {
  const env = envStr || process.env.TARGET_CHAT_ID || '';
  if (!env) return [];
  return env.split(',').map(s => s.trim()).filter(Boolean);
};

const pad2 = (n) => n.toString().padStart(2, '0');

const composeMessageForDate = (schedule, dateObj) => {
  const yyyy = dateObj.getFullYear();
  const mm = pad2(dateObj.getMonth() + 1);
  const dd = pad2(dateObj.getDate());
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const item = schedule.find((d) => d.date === dateStr);
  const type = item ? item.type : 'UNKNOWN';
  return { dateStr, type };
};

// Load the monthly schedule file (db/YYYY-MM.json) that contains the given date.
// Returns an empty array if the file is missing or unreadable.
const loadScheduleForDate = (dateObj, baseDir) => {
  const projectRoot = baseDir || path.join(__dirname, '..');
  const yyyy = dateObj.getFullYear();
  const mm = pad2(dateObj.getMonth() + 1);
  const file = path.join(projectRoot, 'db', `${yyyy}-${mm}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Could not load schedule ${yyyy}-${mm}.json:`, e.message);
    return [];
  }
};

// Look up the collection entry for a single date, loading the correct monthly
// file automatically. Handles month boundaries (e.g. today vs. tomorrow).
const getEntryForDate = (dateObj, baseDir) => {
  const schedule = loadScheduleForDate(dateObj, baseDir);
  return composeMessageForDate(schedule, dateObj);
};

const ensureLogsDir = (baseDir) => {
  // resolve project root: either baseDir provided by callers (typically __dirname from project root)
  // or the parent of this lib directory
  const projectRoot = baseDir || path.join(__dirname, '..');
  const logsDir = path.join(projectRoot, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, 'requests.log');
};

const logRequest = (msg, requestsLogPath, baseDir) => {
  try {
    const chatId = msg.chat && (msg.chat.id || msg.chat.username || 'unknown');
    const user = (msg.from && (msg.from.username || `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim())) || 'unknown';
    const ts = new Date().toISOString();
    const line = `${ts} | chatId=${chatId} | user=${user}`;
    // always log to stdout so pm2 captures it
    console.log(line);
    // optionally persist to file when WRITE_REQUESTS_LOG=true
    if (process.env.WRITE_REQUESTS_LOG === 'true') {
      try {
        const filePath = requestsLogPath || ensureLogsDir(baseDir);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.appendFileSync(filePath, line + '\n');
      } catch (e) {
        console.error('Failed to append request to file:', e.message);
      }
    }
  } catch (e) {
    console.error('Failed to log request:', e.message);
  }
};

// Subscribers are persisted as a plain JSON array of chat-id strings in
// subscribers.json at the project root. This file is runtime state (gitignored)
// and is kept separate from configuration/secrets in .env.
const subscribersFile = (baseDir) => {
  const projectRoot = baseDir || path.join(__dirname, '..');
  return path.join(projectRoot, 'subscribers.json');
};

const getSubscribers = (baseDir) => {
  const file = subscribersFile(baseDir);
  try {
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data.map(String).map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.error('Failed to read subscribers.json:', e.message);
    return [];
  }
};

const writeSubscribers = (list, baseDir) => {
  const file = subscribersFile(baseDir);
  try {
    fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n', 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write subscribers.json:', e.message);
    return false;
  }
};

const subscribeChat = (chatId, baseDir) => {
  const set = new Set(getSubscribers(baseDir));
  set.add(String(chatId));
  return writeSubscribers(Array.from(set), baseDir);
};

const unsubscribeChat = (chatId, baseDir) => {
  const list = getSubscribers(baseDir).filter(id => id !== String(chatId));
  return writeSubscribers(list, baseDir);
};

module.exports = {
  parseTargetChats,
  composeMessageForDate,
  loadScheduleForDate,
  getEntryForDate,
  ensureLogsDir,
  logRequest,
  getSubscribers,
  subscribeChat,
  unsubscribeChat
};

