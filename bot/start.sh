#!/usr/bin/env bash
set -euo pipefail

export REDIS_URL=${REDIS_URL:-redis://redis:6379}
export API_BASE=${API_BASE:-http://app:8004}

if [ -z "${BOT_TOKEN:-}" ]; then
	echo "BOT_TOKEN non impostato — container bot in attesa."
	tail -f /dev/null
fi

if [ -z "${BASE_URL:-}" ]; then
	echo "ATTENZIONE: BASE_URL non impostato — i link interni saranno costruiti con valori vuoti."
fi

echo "Avvio Telegram bot..."
exec python -m app.main
