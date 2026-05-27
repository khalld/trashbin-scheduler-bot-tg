# Trashbin Scheduler Bot (Telegram)

A small Telegram bot that sends daily **waste-collection reminders** based on a
municipal pickup calendar. Every evening it announces today's collection type
and what to put outside tonight for tomorrow's pickup (organic, plastic & metal,
glass, paper, dry waste, etc.).

## Features

- 📅 Daily scheduled notification at **20:30** (local time) for today + tomorrow.
- 🔔 On startup, sends a "bot is up" message plus the current schedule to the
  configured chats.
- 💬 On-demand schedule via the `/info` command.
- 🧑‍🤝‍🧑 Auto-subscribes any chat that messages the bot, persisting subscribers
  into `ecosystem.config.js`.
- 🗂️ Monthly schedules stored as simple JSON files in `db/`.

## How it works

1. For any given date, the bot loads the matching monthly file
   `db/YYYY-MM.json` (an array of `{ "date": "YYYY-MM-DD", "type": "<WASTE TYPE>" }`).
2. `getEntryForDate()` resolves the correct file and looks up that day's entry;
   today and tomorrow are resolved independently, so month boundaries work even
   when they fall in different files. Missing files or days report `UNKNOWN`.
3. Each waste type is mapped to an emoji via `lib/constants.js`.
4. A `setTimeout`-based scheduler (`scheduleNextRun`) fires once per day at 20:30
   and messages every target chat.

> **Adding a new month:** just drop a `db/YYYY-MM.json` file in place (e.g.
> `db/2026-06.json`). No code changes are needed — the file is selected
> automatically from the current date.

## Project structure

```
.
├── trashbin-day-handler.js   # Main bot: commands + daily scheduler
├── bot-test01.js             # Minimal echo bot used for testing
├── ecosystem.config.js       # PM2 process file (no secrets)
├── .env.example              # Template for local secrets/config
├── lib/
│   ├── constants.js          # Waste type → emoji map
│   └── utils.js              # Schedule parsing, logging, subscriber persistence
├── subscribers.json          # Auto-saved subscriber chat IDs (gitignored, runtime)
└── db/
    └── YYYY-MM.json          # Monthly collection schedules (e.g. 2026-05.json)
```

## Requirements

- Node.js **v20+** (see `.node-version`)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- [PM2](https://pm2.keymetrics.io/) for process management (recommended)

> 📦 **Deploying on a Raspberry Pi?** Follow the step-by-step
> [INSTALL.md](INSTALL.md) guide. It also covers a single-file bundle and
> installing from npm (`npm i -g trashbin-scheduler-bot-tg`).

## Setup

```bash
# 1. Install dependencies (use --omit=dev in production)
npm install

# 2. Create your local config from the template and fill in BOT_TOKEN
cp .env.example .env
$EDITOR .env

# 3. Start the bot
npm start
```

## Configuration

Configuration is read from a local **`.env`** file (loaded via
[`dotenv`](https://www.npmjs.com/package/dotenv)) — copy `.env.example` to
`.env` and fill it in. The `.env` file is gitignored and must never be
committed. `ecosystem.config.js` contains **no secrets**.

| Variable              | Required | Description                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------------- |
| `BOT_TOKEN`           | ✅ yes   | Telegram bot token from BotFather.                                          |
| `TARGET_CHAT_ID`      | no       | Comma-separated chat IDs to receive scheduled messages.                     |
| `ADMIN_CHAT_ID`       | no       | Comma-separated admin chat IDs allowed to run `/subscribers`.               |
| `SEND_TO_SUBSCRIBERS` | no       | `true` to send to saved subscribers (`subscribers.json`) instead of `TARGET_CHAT_ID`. |
| `WRITE_REQUESTS_LOG`  | no       | `true` to also append request logs to `logs/requests.log`.                  |

> ⚠️ **Security:** never commit a real `BOT_TOKEN`. Keep it in `.env` only. If a
> token is ever exposed (e.g. pushed to git), revoke/regenerate it through
> BotFather immediately.

## Bot commands

| Command            | Who      | Description                                              |
| ------------------ | -------- | -------------------------------------------------------- |
| `/info`            | anyone   | Replies with today's and tomorrow's collection.          |
| `/week`            | anyone   | Schedule for the next 7 days.                            |
| `/month`           | anyone   | Full calendar for the current month.                     |
| `/help` (`/start`) | anyone   | Lists the available commands.                            |
| `/echo <text>`     | anyone   | Echoes the text back (debug helper).                     |
| `/subscribers`     | admin    | Lists subscriber chat IDs (requires `ADMIN_CHAT_ID`).    |
| `/unsubscribe`     | anyone   | Removes the chat from the subscriber list.               |

Commands are also registered in Telegram's command menu (via `setMyCommands`).
Sending any message also auto-subscribes the chat and logs the request.

## Schedule data format

Each file in `db/` is a JSON array of daily entries:

```json
[
  { "date": "2026-05-02", "type": "ORGANICO" },
  { "date": "2026-05-05", "type": "PLASTICA E METALLI" }
]
```

### Waste types & emoji legend

| Type                 | Emoji |
| -------------------- | ----- |
| `ORGANICO`           | 🥦    |
| `PLASTICA E METALLI` | ♻️    |
| `VETRO`              | 🍾    |
| `CARTA E CARTONE`    | 📦    |
| `SECCO RESIDUO`      | 🗑️    |
| `NO SERVICE`         | ⛔️    |
| `UNKNOWN`            | ❓    |

## Running with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start using the ecosystem config (reads env vars from ecosystem.config.js)
pm2 start ecosystem.config.js

# Common operations
pm2 status                 # list processes
pm2 logs trashbin-bot      # stream logs in real time
pm2 restart trashbin-bot   # restart
pm2 stop trashbin-bot      # stop
pm2 delete trashbin-bot    # remove from the process list
```

To start the bot automatically on boot:

```bash
pm2 startup    # prints a command to run with sudo — run it exactly as shown
pm2 save       # persist the current process list
```

## License

See [LICENSE](LICENSE).

Reminder still standing: revoke the old BOT_TOKEN in @BotFather if you haven't — it was in the pre-squash history that existed on GitHub.