#!/usr/bin/env bash
set -euo pipefail

echo "Attendo che il DB sia raggiungibile..."
DB_WAIT_MAX_ATTEMPTS=${DB_WAIT_MAX_ATTEMPTS:-60}
DB_WAIT_SLEEP_SECONDS=${DB_WAIT_SLEEP_SECONDS:-2}
DB_READY=0
for i in $(seq 1 "${DB_WAIT_MAX_ATTEMPTS}"); do
	if python - <<'PY'
import os
import sys
from sqlalchemy import create_engine, text

db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise SystemExit(1)

try:
	engine = create_engine(db_url, pool_pre_ping=True)
	with engine.connect() as conn:
		conn.execute(text("SELECT 1"))
except Exception:
	# Avoid noisy tracebacks while DB/DNS are still converging during startup.
	sys.exit(1)
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

# Il BE serve SOLO l'API. Il bot Telegram e gli scraper vivono nel componente
# separato `bot/` (immagine e container propri).
echo "Avvio uvicorn (API) sulla porta 8004..."
exec uvicorn app.server:app --host 0.0.0.0 --port 8004
