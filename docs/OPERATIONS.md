# OPERATIONS — avvio, variabili, deploy

<!-- Tipo: HOW-TO. Passi per un obiettivo operativo: avviare, deployare, leggere i log. -->

## Avvio con Docker Compose (consigliato)

```bash
docker compose up -d
```

Servizi avviati:

- **app** (BE, FastAPI): `http://localhost:8004` — Swagger su `/docs`
- **bot** (Telegram + scraper): nessuna porta esposta
- **frontend** (FE, nginx): `http://localhost:3002`
- **db** (Postgres 15) e **redis**: rete interna

### `.env`

```env
BOT_TOKEN=<tuo_token>
ALLOWED_TELEGRAM_USER_IDS=<id1,id2>
BASE_URL=http://10.0.0.5:3002
```

- `BASE_URL` serve al bot per costruire i link interni nei messaggi: deve puntare
l'host reale, **non** `localhost`.
- Se `ALLOWED_TELEGRAM_USER_IDS` non e' impostato il bot accetta link da **qualsiasi**
  utente (logga un warning): in produzione va sempre impostato.
- `BOT_TOKEN` mancante: `bot/start.sh` non avvia il bot e lascia il container in attesa.

### Avvio locale senza Docker (solo Postgres e Redis)

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

Quel compose espone Postgres (porta 5432) e Redis (6379) per lo sviluppo.

### Setup locale dei tre componenti

**1. BE (API)**

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export DATABASE_URL="postgresql+psycopg2://user:password@localhost:5432/products"
uvicorn app.server:app --app-dir backend --host 0.0.0.0 --port 8004 --reload
```

**2. FE**

```bash
cd frontend
npm install
npm run dev
```

**3. BOT (Telegram + scraper)**

```bash
cd bot
pip install -r requirements.txt
playwright install chromium
export API_BASE=http://localhost:8004
export BASE_URL=http://localhost:3002
export REDIS_URL=redis://localhost:6379
python -m app.main
```

Il bot non tocca il database: usa `bot/app/api_client.py` per parlare col BE.

### Shortcut Makefile

| Target | Cosa fa |
|---|---|
| `make dev-backend` | venv + requirements + uvicorn in reload |
| `make dev-frontend` | `npm install` + `npm run dev` |
| `make start-bot` | `cd bot && python -m app.main` |

## Variabili d'ambiente

**BE** (`docker-compose.yml` -> `app`):

| Variabile | Default | A cosa serve |
|---|---|---|
| `DATABASE_URL` | — | URL SQLAlchemy; se manca si usa SQLite in `backend/storage/db.sqlite` |

**BOT** (`docker-compose.yml` -> `bot`):

| Variabile | Default | A cosa serve |
|---|---|---|
| `BOT_TOKEN` | — | token del bot Telegram (obbligatorio) |
| `BASE_URL` | `http://localhost:3002` | base dei link interni nei messaggi |
| `API_BASE` | `http://app:8004` | URL del BE dentro la rete compose |
| `REDIS_URL` | `redis://redis:6379` | Redis per code e set pending |
| `ALLOWED_TELEGRAM_USER_IDS` | — | utenti autorizzati (CSV di id) |
| `BETWEEN_SCRAPES_SECONDS` | `20` | pausa fra uno scrape e il successivo |
| `SCRAPE_MAX_SECONDS` | `5` | budget per singolo scrape, usato solo per le stime |
| `SCRAPE_MAX_ATTEMPTS` | `3` | tentativi per item (1 + retry in `RETRY_BACKOFF_SECONDS`) |
| `RETRY_BACKOFF_SECONDS` | `5,15` | backoff fra un tentativo e il successivo |
| `WORKER_WATCHDOG_INTERVAL_SECONDS` | `60` | ogni quanto il watchdog controlla i worker |

**FE**: `VITE_APP_VERSION` (build arg nel Dockerfile; in CI vale `v0.1.11`).

## Comandi utili

```bash
docker compose exec app bash
docker compose exec db psql -U postgres -d products
docker compose logs -f app
docker compose logs -f bot
docker compose down
```

## Test dello scraping

Manda un link al bot e segui i log:

```bash
docker compose logs -f bot
```

All'avvio il bot scrive su stdout: `Bot avviato...`, `Set pending ricostruito (N voci)`,
`Coda riavviata per <sito>`.

## Database

- **Produzione**: Postgres 15 (container `db`), DB `products`.
- **Sviluppo**: `infra/docker-compose.dev.yml` (Postgres 18) oppure SQLite in fallback
  (nessuna `DATABASE_URL`).
- **Schema**: `Product`, `Image`, `Price`, `SourceUrl`, `Category`, `Tag`, `Bundle`.
- Solo il BE accede al DB.

## Deploy

- Le modifiche arrivano via branch -> PR -> merge in `main`.
- CI (`.github/workflows/docker-build-push.yml`) costruisce **3 immagini** su Docker Hub
  (`frontend-latest`, `backend-latest`, `bot-latest`) ad ogni push su `main`.
- Sul server: `git pull` e `docker compose up -d` nella directory del compose.
- Volumi condivisi fra BE e bot: `images/`, `tmp/`, `storage_data/` (il BE serve `/media`
  le immagini scritte dal bot).
- `app_data/` (log degli scraper) **non** e' montato: il file di log vive nel container;
  i log restano comunque visibili su stdout (`docker compose logs bot`).

## Stato dei Dependabot PR

Ci sono PR Dependabot aperte: mergiarle aggiorna i manifest. Il file
`.github/dependabot.yml` copre gia' tutti gli ecosistemi del repo (pip `/backend` e
`/bot`, npm `/frontend`, docker `/backend` `/bot` `/frontend`, docker-compose `/` e
`/infra`, github-actions).
