#!/usr/bin/env bash
set -euo pipefail

export REDIS_URL=${REDIS_URL:-redis://redis:6379}

echo "Attendo che il DB sia raggiungibile..."
DB_WAIT_MAX_ATTEMPTS=${DB_WAIT_MAX_ATTEMPTS:-60}
DB_WAIT_SLEEP_SECONDS=${DB_WAIT_SLEEP_SECONDS:-2}
DB_READY=0
for i in $(seq 1 "${DB_WAIT_MAX_ATTEMPTS}"); do
	if python - <<'PY'
import os
from sqlalchemy import create_engine, text

db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise SystemExit(1)

engine = create_engine(db_url, pool_pre_ping=True)
with engine.connect() as conn:
    conn.execute(text("SELECT 1"))
PY
	then
		echo "DB raggiungibile (tentativo ${i}/${DB_WAIT_MAX_ATTEMPTS})."
		DB_READY=1
		break
	fi
	echo "DB non ancora pronto (tentativo ${i}/${DB_WAIT_MAX_ATTEMPTS})..."
	sleep "${DB_WAIT_SLEEP_SECONDS}"
done

if [ "${DB_READY}" -ne 1 ]; then
	echo "DB non raggiungibile dopo ${DB_WAIT_MAX_ATTEMPTS} tentativi: esco con errore."
	exit 1
fi

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
