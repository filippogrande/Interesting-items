# Interesting Items

Product scraper: si mandano link di annunci via Telegram, il bot li scrapa e li salva; una UI web permette di consultarli e modificarli.

Il progetto è diviso in **3 componenti separati** (codice, immagine Docker e container propri):

- `frontend/` — **FE** (React + Vite + nginx)
- `backend/` — **BE** (FastAPI; **unico proprietario del database**)
- `bot/` — **BOT** (bot Telegram + scraper)

Regola: FE e bot parlano al BE **solo via HTTP**. Vedi `PROJECT_ARCHITECTURE.md` e `DEVELOPMENT_GUIDELINES.md`.

## Setup con Docker Compose ✅ (consigliato)

```bash
docker compose up -d
```

Espone / avvia:

- **app** (BE, FastAPI): `http://localhost:8004`
- **bot** (Telegram + scraper): nessuna porta esposta
- **frontend** (FE, nginx): `http://localhost:3002`
- **db** (Postgres 15) e **redis**: rete interna

Crea `.env`:

```env
BOT_TOKEN=<tuo_token>
ALLOWED_TELEGRAM_USER_IDS=<id1,id2>
BASE_URL=http://10.0.0.5:3002
```

`BASE_URL` serve al bot per costruire i link interni nei messaggi (non usare `localhost`).

## Setup locale (senza Docker)

### 1. BE (API)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export DATABASE_URL="postgresql+psycopg2://user:password@localhost:5432/products"
uvicorn app.server:app --app-dir backend --host 0.0.0.0 --port 8004 --reload
```

### 2. FE

```bash
cd frontend
npm install
npm run dev
```

### 3. BOT (Telegram + scraper)

```bash
cd bot
pip install -r requirements.txt
export API_BASE=http://localhost:8004
export BASE_URL=http://localhost:3002
export REDIS_URL=redis://localhost:6379
python -m app.main
```

Il bot non tocca il database: usa `bot/app/api_client.py` per parlare col BE.

## Bot Telegram ✅

- **`/start` o `/help`**: istruzioni
- **Invia un link**: scraping + salvataggio (via API del BE)
- **Domini accettati**: vinted.it, wallapop.com, subito.it, ebay.it, aliexpress.com
  (scraper implementati: **Vinted**, **AliExpress**; Wallapop/Subito non ancora)
- **Anti-duplicato**: il bot controlla su due livelli — (1) il prodotto è già nel DB (`GET /api/sourceurls/lookup`) e (2) il link è **ancora in coda o in lavorazione** (set Redis `scrape_pending`). Stesso link ripetuto nello stesso messaggio: ignorato.
- **Annuncio rimosso/venduto**: se Vinted risponde 404/410 (o serve la pagina "non trovato") il bot lo dice esplicitamente (*annuncio non più disponibile*) invece di mostrare un errore generico.
- **Venditore (Vinted)**: dalla pagina annuncio vengono salvati username/id/link del profilo in `product_metadata`.

## Struttura Frontend

React + Vite + TypeScript. `main.tsx` è un orchestratore snello; la logica sta negli hook (`frontend/src/hooks/`) e la UI nei componenti (`frontend/src/components/`). Vedi `docs/FEATURES.md` per la mappa funzionale.

## Test dello scraping

Manda un link al bot e segui i log:

```bash
docker compose logs -f bot
```

## Database

- **Produzione**: Postgres 15 (container `db`)
- **Sviluppo**: SQLite (fallback)
- **Schema**: Product, Image, Price, SourceUrl, Category, Tag, Bundle
- Solo il BE accede al DB.

## Comandi

```bash
docker compose exec app bash
docker compose exec db psql -U postgres -d products
docker compose logs -f app
docker compose logs -f bot
docker compose down
```
