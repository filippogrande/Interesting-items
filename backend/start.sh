#!/usr/bin/env bash
set -euo pipefail

export REDIS_URL=${REDIS_URL:-redis://redis:6379}

echo "Inizializzo DB..."
python - <<'PY'
from storage.db import init_db
init_db()
print('DB inizializzato')
PY

echo "Avvio uvicorn (API) sulla porta 8004..."
uvicorn app.api:app --host 0.0.0.0 --port 8004 &
UVICORN_PID=$!

echo "Avvio RQ worker..."
rq worker -u ${REDIS_URL} default &
RQ_PID=$!

echo "Avvio Telegram bot in foreground..."
# Foreground process keeps the container alive; il bot è eseguito come modulo package
if [ -z "${BOT_TOKEN:-}" ]; then
	echo "BOT_TOKEN non impostato — avvio API e worker solamente. Container rimane attivo."
	# Mantieni il container in esecuzione
	tail -f /dev/null
else
	python -m app.bot || true
	echo "Bot terminato, arresto processi figli..."
	kill $UVICORN_PID $RQ_PID || true
	wait
fi
