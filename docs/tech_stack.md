Tech Stack — Product Scraper (Web + Telegram Bot)

> Aggiornato 16 settembre 2026 allo **stato reale** del progetto.
> Il progetto è diviso in 3 componenti separati: FE (`frontend/`), BE (`backend/`), BOT (`bot/`).
> La sezione "Non implementato" elenca le idee del design iniziale mai realizzate.

1. Componenti

- **BE** (`backend/`) — Python + FastAPI + SQLModel. **Unico proprietario del database.** Serve l'API REST.
- **BOT** (`bot/`) — Python + aiogram (polling) + Playwright/BeautifulSoup. **Non accede al DB**: parla al BE via HTTP (`bot/app/api_client.py`).
- **FE** (`frontend/`) — React + Vite + TypeScript, build servita da nginx.

2. Scelte principali (BE)

- Framework: FastAPI (OpenAPI/Swagger integrato su `/docs`)
- ORM: SQLModel (su SQLAlchemy) — compatibile Alembic, ma **le migration non sono in uso**
- Web server: uvicorn
- Entrypoint: `uvicorn app.server:app` (assemblaggio in `backend/app/server.py`)

3. Scraping (BOT)

- **Playwright** (Chromium headless) per il rendering JS: **Vinted**, **AliExpress**.
- **BeautifulSoup** per il parsing dell'HTML renderizzato.
- Vinted: `wait_until="domcontentloaded"` + wait `h1` + attesa fissa. `networkidle` **non** va usato: Vinted ricarica di continuo e va in timeout.
- `requests` da solo non basta: i marketplace rendono il contenuto via JS.

4. Code / background jobs

- **Redis con LISTE** (`scrape_queue:<sito>`), una coda per sito, gestita dal bot.
- Il **RQ worker è stato rimosso**: nessuno accodava job RQ, il container lo avviava per nulla.

5. Database

- Postgres 15 in produzione (container `db`); SQLite come fallback locale.
- Schema gestito dall'app (`init_db()` con `create_all`): **non** aggiunge colonne a tabelle esistenti.

6. Storage immagini

- Filesystem locale su volume **condiviso fra BE e BOT** (`images/`).
- Il BOT scarica le immagini, il BE le serve su `/media`.

7. Variabili d'ambiente (reali)

- **BE**: `DATABASE_URL`
- **BOT**: `BOT_TOKEN`, `REDIS_URL`, `ALLOWED_TELEGRAM_USER_IDS`, `BASE_URL` (link interni nei messaggi), `API_BASE` (URL del BE, es. `http://app:8004`)
- **FE**: `VITE_APP_VERSION` (build arg)

8. CI/CD e deploy

- GitHub Actions: build + push di **3 immagini** su Docker Hub (`frontend-latest`, `backend-latest`, `bot-latest`) ad ogni push su `main`.
- Deploy: `git pull` + `docker compose up -d` in `/mnt/applicazioni/yml/docker/interesting-items`.

9. Non implementato (idee del design iniziale)

- Object storage S3 per le immagini (si usa il filesystem)
- IndexedDB nel client
- Endpoint `POST /api/scrape` e `POST /api/sync-local`
- Full-text search con `tsvector`
- Migration Alembic (lo schema si evolve via nuova versione dell'app)
- Webhook Telegram (si usa il polling)
- RQ (sostituito dalle liste Redis del bot)
