Project: Product Scraper (Web + Telegram Bot)

## Setup con Docker Compose ✅ (consigliato)

```bash
docker compose up --build
```

Espone:

- **API FastAPI**: `http://localhost:8004`
- **Postgres**: rete interna
- **Redis**: rete interna

Crea `.env`:

```env
BOT_TOKEN=<tuo_token>
ALLOWED_TELEGRAM_USER_IDS=<id1,id2>
```

## Setup locale (senza Docker)

1. Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export DATABASE_URL="postgresql+psycopg2://user:password@localhost:5432/products"
uvicorn backend.app.api:app --host 0.0.0.0 --port 8004 --reload
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

3. Worker

```bash
rq worker -u $REDIS_URL default
```

## Bot Telegram ✅

Il bot è **già implementato**:

- **Comando `/start` o `/help`**: istruzioni
- **Invia un link**: scraping + salvataggio DB
- **Domini supportati**: vinted.it, wallapop.com, subito.it, ebay.it, aliexpress.com

## Script di test

Scraping senza Telegram:

```bash
cd backend
python app/test_aliexpress.py
```

## Database

- **Produzione**: Postgres 15 (Docker)
- **Sviluppo**: SQLite (fallback)
- **Schema**: Product, Image, Price, SourceUrl, Category

## Comandi

```bash
docker compose exec app bash
docker compose exec db psql -U postgres -d products
docker compose logs -f app
docker compose down
```
