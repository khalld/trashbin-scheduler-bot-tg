# readme

npm install -g pm2

cd /Users/danilo/GitHub/trashbin-scheduler-bot-tg
pm2 start trashbin-day-handler.js --name trashbin-bot


pm2 status                 # vedi processi
pm2 logs trashbin-bot      # stream log in tempo reale
pm2 restart trashbin-bot   # riavvia
pm2 stop trashbin-bot      # ferma
pm2 delete trashbin-bot    # rimuove dal process list

pm2 startup

il comando stampa una riga da eseguire con sudo: eseguila esattamente come mostrata
poi salva la lista dei processi

pm2 save


il comando nuovo x partire con la config isuta e 

khd@plutopi3:~/trashbin-scheduler-bot-tg $ pm2 start ecosystem.config.js
