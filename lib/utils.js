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

// subscribers persistence using require() to parse ecosystem.config.js and rewrite it safely
const ecosystemFile = (baseDir) => {
  const projectRoot = baseDir || path.join(__dirname, '..');
  return path.join(projectRoot, 'ecosystem.config.js');
};

const recast = require('recast');

const loadEcosystemObject = (baseDir) => {
  const file = ecosystemFile(baseDir);
  try {
    if (!fs.existsSync(file)) return null;
    const resolved = require.resolve(file);
    delete require.cache[resolved];
    // eslint-disable-next-line global-require,import/no-dynamic-require
    const obj = require(file);
    return obj;
  } catch (e) {
    console.error('Failed to load ecosystem.config.js as module:', e.message);
    return null;
  }
};

const writeEcosystemObject = (obj, baseDir) => {
  const file = ecosystemFile(baseDir);
  try {
    // read original content to preserve formatting/comments using recast
    const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (!original) {
      const content = 'module.exports = ' + JSON.stringify(obj, null, 2) + ';\n';
      fs.writeFileSync(file, content, 'utf8');
      return true;
    }
    const ast = recast.parse(original);
    const b = recast.types.builders;
    let replaced = false;
    recast.types.visit(ast, {
      visitAssignmentExpression(pathExp) {
        const node = pathExp.node;
        // look for module.exports = ...
        if (node.left && node.left.object && node.left.object.name === 'module' && node.left.property && node.left.property.name === 'exports') {
          // replace right-hand side with our object literal built from JSON
          const json = JSON.stringify(obj, null, 2);
          const newAst = recast.parse('module.exports = ' + json + ';');
          pathExp.replace(newAst.program.body[0].expression);
          replaced = true;
          return false;
        }
        this.traverse(pathExp);
        return undefined;
      }
    });
    if (!replaced) {
      // fallback: overwrite file with a clean module.exports
      const content = 'module.exports = ' + JSON.stringify(obj, null, 2) + ';\n';
      fs.writeFileSync(file, content, 'utf8');
      return true;
    }
    const output = recast.print(ast).code;
    fs.writeFileSync(file, output, 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write ecosystem.config.js object via recast:', e.message);
    return false;
  }
};

const getSubscribers = (baseDir) => {
  const obj = loadEcosystemObject(baseDir);
  if (!obj) return [];
  const apps = Array.isArray(obj.apps) ? obj.apps : (obj.app ? [obj.app] : []);
  if (apps.length === 0) return [];
  // try to find first env with TARGET_CHAT_ID
  for (const app of apps) {
    if (app && app.env && app.env.TARGET_CHAT_ID) {
      return String(app.env.TARGET_CHAT_ID).split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
};

const subscribeChat = (chatId, baseDir) => {
  const obj = loadEcosystemObject(baseDir) || { apps: [] };
  const apps = Array.isArray(obj.apps) ? obj.apps : (obj.app ? [obj.app] : []);
  if (apps.length === 0) {
    // create a default app entry
    obj.apps = [{ name: 'trashbin-scheduler-bot', script: './trashbin-day-handler.js', env: { TARGET_CHAT_ID: String(chatId) } }];
    return writeEcosystemObject(obj, baseDir);
  }
  // update first app that has env
  const app = apps[0];
  app.env = app.env || {};
  const current = String(app.env.TARGET_CHAT_ID || '');
  const set = new Set(current.split(',').map(s => s.trim()).filter(Boolean));
  set.add(String(chatId));
  app.env.TARGET_CHAT_ID = Array.from(set).join(',');
  return writeEcosystemObject(obj, baseDir);
};

const unsubscribeChat = (chatId, baseDir) => {
  const obj = loadEcosystemObject(baseDir);
  if (!obj) return false;
  const apps = Array.isArray(obj.apps) ? obj.apps : (obj.app ? [obj.app] : []);
  if (apps.length === 0) return false;
  const app = apps[0];
  app.env = app.env || {};
  const current = String(app.env.TARGET_CHAT_ID || '');
  const list = current.split(',').map(s => s.trim()).filter(Boolean).filter(id => id !== String(chatId));
  app.env.TARGET_CHAT_ID = list.join(',');
  return writeEcosystemObject(obj, baseDir);
};

module.exports = {
  parseTargetChats,
  composeMessageForDate,
  ensureLogsDir,
  logRequest,
  getSubscribers,
  subscribeChat,
  unsubscribeChat
};

