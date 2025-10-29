const fs = require('fs');
const path = require('path');

const parseTargetChats = (envStr) => {
  const env = envStr || process.env.TARGET_CHAT_ID || '';
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

const ensureLogsDir = (baseDir) => {
  const logsDir = path.join(baseDir || __dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, 'requests.log');
};

const logRequest = (msg, requestsLogPath) => {
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
        const filePath = requestsLogPath || path.join(__dirname, '..', 'logs', 'requests.log');
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

// subscribers persistence (db/chats.json)
const subscribersFile = (baseDir) => path.join(baseDir || __dirname, '..', 'db', 'chats.json');

const getSubscribers = (baseDir) => {
  const file = subscribersFile(baseDir);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read subscribers:', e.message);
    return [];
  }
};

const subscribeChat = (chatId, baseDir) => {
  const file = subscribersFile(baseDir);
  let list = [];
  try {
    if (fs.existsSync(file)) {
      list = JSON.parse(fs.readFileSync(file, 'utf8')) || [];
    }
    if (!list.includes(chatId)) {
      list.push(chatId);
      fs.writeFileSync(file, JSON.stringify(list, null, 2));
    }
  } catch (e) {
    console.error('Failed to update subscribers:', e.message);
  }
};

module.exports = {
  parseTargetChats,
  composeMessageForDate,
  ensureLogsDir,
  logRequest,
  getSubscribers,
  subscribeChat
};

