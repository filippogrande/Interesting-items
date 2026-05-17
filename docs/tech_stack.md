Tech Stack — Progetto Web + Telegram Bot (definizione)

Scopo: documento breve e pratico che specifica lo stack tecnologico scelto e le scelte operative per lo sviluppo iniziale (MVP).

1. Scelte principali

- Backend: Python 3.11
  - Framework: FastAPI (async, OpenAPI integrato)
  - ORM: SQLAlchemy / SQLModel (compatibile con Alembic per migration)
  - Web server: Uvicorn (dev) / Gunicorn + Uvicorn workers (prod)
- Bot Telegram: aiogram (async) — polling in sviluppo, pronto a switchare a webhook in produzione
- Queue / background jobs: Redis + RQ (semplice, sufficiente per carico basso)
- Scraping: requests + BeautifulSoup (prima); Playwright escluso per ora (opzionale in futuro)
- DB: PostgreSQL (prod), SQLite per sviluppo locale
- Storage immagini: S3-compatible (produzione) / filesystem locale per sviluppo

2. Frontend

- Framework: React
- Tooling: Vite + TypeScript
- Local storage: IndexedDB via `idb` (wrapper) per sincronizzazione e UX offline

3. API & contratto

- REST API con FastAPI + OpenAPI auto-generated
- API auth: opzionale (API-key/JWT) — non abilitata per MVP Web UI non protetta

4. Identificatori e formati

- PK consigliata: `serial` (integer autoincrement) per semplicità; migrabile a `UUID` in futuro se necessario
- Date/time: ISO8601 UTC in DB; visualizzazione in `Europe/Rome` sul client
- Valuta: ISO code (default: EUR)

5. Operazioni e dev tooling

- Contenitori: Dockerfile per ogni componente (da aggiungere in fase di packaging)
- CI: GitHub Actions (lint, test, build)
- Logging: stdout JSON-structured; integrazione con Sentry/Prometheus opzionale

6. Environment variables minime (esempio)

- BOT_TOKEN
- DATABASE_URL
- REDIS_URL
- S3_BUCKET, S3_ENDPOINT (se compatibile), S3_ACCESS_KEY, S3_SECRET_KEY
- BASE_URL
- ENV (development|production)
- DEFAULT_CURRENCY (EUR)

7. Motivazioni sintetiche

- Python + FastAPI: rapido sviluppo, async naturale per scraping e bot
- RQ: semplice da integrare e mantenere per carico singolo-utente
- React+TS: UI moderna, tipizzazione utile per UX e sincronizzazione con IndexedDB
- Postgres + S3: storage solido e scalabile in futuro

8. Prossimi step raccomandati

- Generare scaffold progetto (backend + bot + RQ worker) e `requirements.txt`/`pyproject.toml`
- Creare schema SQL iniziale + Alembic migrations
- Creare boilerplate frontend Vite + React + TypeScript e setup IndexedDB

---

Note: questo file è pensato come riferimento operativo breve; se vuoi lo trasformo in un file più formale (tabella di tipi DB, version pin, policy di deploy).
