# Installation guide — Raspberry Pi Zero 2 W

This guide walks through installing and running the Trashbin Scheduler Bot on a
**Raspberry Pi Zero 2 W** with **PM2**. The bot has only pure-JavaScript
dependencies (no native compilation), so it installs quickly even on the Pi's
512 MB of RAM.

> The same steps work on any Debian/Raspberry Pi OS machine.
>
> **Don't want git on the Pi?** Jump to
> [§10 — deploy as a single-file bundle](#10-alternative-deploy-as-a-single-file-bundle-no-git-on-the-pi).

---

## 1. Prerequisites

- Raspberry Pi Zero 2 W running **Raspberry Pi OS** (Bullseye or Bookworm).
- Network access (Wi-Fi configured).
- A Telegram account.

Update the system first:

```bash
sudo apt update && sudo apt full-upgrade -y
```

---

## 2. Install Node.js (v20+)

The project requires **Node.js 20 or newer**. Install it from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node -v   # should print v22.x (or v20+)
npm -v
```

> Tip: if `apt` cannot find a matching package on an older 32-bit OS, install
> Node via [nvm](https://github.com/nvm-sh/nvm) instead:
> `nvm install 22 && nvm use 22`.

---

## 3. Create your Telegram bot & get the token

1. Open Telegram and chat with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts.
3. BotFather replies with a **token** like `123456789:AAH...`. Copy it — this is
   your `BOT_TOKEN`.

### Find your chat ID

1. Send any message to your new bot.
2. Message [@userinfobot](https://t.me/userinfobot) — it replies with your
   numeric **chat ID**. Use this for `TARGET_CHAT_ID` and `ADMIN_CHAT_ID`.

---

## 4. Get the code

```bash
cd ~
git clone <your-repo-url> trashbin-scheduler-bot-tg
cd trashbin-scheduler-bot-tg
```

Install only production dependencies (faster, lighter on the Pi):

```bash
npm install --omit=dev
```

---

## 5. Configure secrets (`.env`)

Secrets are read from a local `.env` file that is **never committed**.

```bash
cp .env.example .env
nano .env
```

Fill in at least `BOT_TOKEN`. Example:

```ini
BOT_TOKEN=123456789:AAHyour-real-token-here
TARGET_CHAT_ID=7328814364
ADMIN_CHAT_ID=7328814364
SEND_TO_SUBSCRIBERS=false
WRITE_REQUESTS_LOG=false
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

---

## 6. Test run

```bash
npm start
```

You should see scheduling logs, and the configured chat should receive a
"🚀 Bot is up" message. Stop the test with `Ctrl+C`.

---

## 7. Run under PM2 (auto-restart + boot startup)

Install PM2 globally:

```bash
sudo npm install -g pm2
```

Start the bot using the bundled process file:

```bash
pm2 start ecosystem.config.js
```

Make it survive reboots:

```bash
pm2 save              # save the current process list
pm2 startup           # prints a `sudo ...` command — run it exactly as shown
```

After running the printed `sudo` command, run `pm2 save` once more.

### Useful PM2 commands

```bash
pm2 status                 # list processes
pm2 logs trashbin-bot      # stream logs in real time
pm2 restart trashbin-bot   # restart
pm2 stop trashbin-bot      # stop
pm2 delete trashbin-bot    # remove from the process list
```

---

## 8. Updating the bot

```bash
cd ~/trashbin-scheduler-bot-tg
git pull
npm install --omit=dev
pm2 restart trashbin-bot
```

Your `.env` and `subscribers.json` are gitignored, so updates won't touch them.

---

## 9. Adding a new month's schedule

Drop a JSON file named `db/YYYY-MM.json` into the `db/` folder — no code change
needed. The bot picks the correct file automatically based on the date.

```json
[
  { "date": "2026-06-01", "type": "ORGANICO" },
  { "date": "2026-06-04", "type": "PLASTICA E METALLI" }
]
```

Then restart: `pm2 restart trashbin-bot`.

---

## 10. Alternative: deploy as a single-file bundle (no git on the Pi)

If you don't want to clone the repo or run `npm install` on the Pi, compile the
whole app (code + dependencies) into one JavaScript file on your dev machine and
copy just that file across. The Pi still needs **Node** and **PM2** (steps 2 and
7), but no source checkout and no `node_modules`.

### On your dev machine

```bash
npm install        # includes the @vercel/ncc build tool
npm run build      # produces dist/index.js (self-contained)
```

Copy the bundle plus the schedule data and your config to the Pi. The `db/`
folder must sit next to `index.js`, and `.env` must be in the same folder:

```bash
scp dist/index.js   pi@raspberrypi:~/trashbin-bot/index.js
scp -r db           pi@raspberrypi:~/trashbin-bot/db
scp .env            pi@raspberrypi:~/trashbin-bot/.env   # or create it on the Pi
```

### On the Pi

```bash
cd ~/trashbin-bot                       # run from here so .env + db/ resolve
pm2 start index.js --name trashbin-bot
pm2 save
```

> The bundle reads `db/` relative to its own location and `.env` from the
> current directory, so always start it from the folder that contains
> `index.js`, `db/`, and `.env`. `subscribers.json` is created there too.

### Updating later

Rebuild on your dev machine and copy only the new file:

```bash
npm run build
scp dist/index.js pi@raspberrypi:~/trashbin-bot/index.js
ssh pi@raspberrypi 'pm2 restart trashbin-bot'
```

To add a new month, just drop a `db/YYYY-MM.json` onto the Pi — no rebuild
needed, since schedules are read at runtime, not bundled.

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Error: BOT_TOKEN is not set` | Check `.env` exists and `BOT_TOKEN` is filled. |
| No scheduled message arrives | Confirm `TARGET_CHAT_ID` is set, or message the bot once so it auto-subscribes. |
| `(type) UNKNOWN` in messages | The current date isn't in any `db/YYYY-MM.json`, or the month file is missing. |
| Bot uses too much memory | `ecosystem.config.js` already restarts at 120 MB via `max_memory_restart`. |
| `409 Conflict` from Telegram | The bot is running twice (e.g. a test run + PM2). Keep only one instance. |
