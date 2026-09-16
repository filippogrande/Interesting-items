# Architettura Interesting Items

> Mappa della struttura reale del progetto. Coerente con `DEVELOPMENT_GUIDELINES.md`.
> Ultimo aggiornamento: 16 settembre 2026

## Componenti (3, separati)

Il progetto è diviso in tre componenti indipendenti, con codice, immagine Docker e
container propri. Regola d'oro: **il BE è l'unico proprietario del database**; FE e bot
parlano al BE **solo via HTTP**.

```
frontend/   → FE  (React + Vite + nginx)        immagine: ...:frontend-latest
backend/    → BE  (FastAPI + modelli DB)        immagine: ...:backend-latest
bot/        → BOT (Telegram + scraper)          immagine: ...:bot-latest
```

### FE — `frontend/`
- `src/main.tsx` — **orchestratore**: compone gli hook e rende la vista attiva (dashboard/tags/sources/merge).
- `src/hooks/` — logica di stato: `useProducts`, `useProductDetail`, `useMerge`, `useBundles`, `useTags`, `useSourceWebsites`.
- `src/components/` — UI: `ProductDetailPanel`, `MergeView`, `TagsView`, `SourcesView`, `ProductCard`, `CreationModal`, `LightboxViewer`, `Stats`.
- `src/utils/format.ts` — helper (`fetchJson`, `formatDate`, `formatMoney`, `derivePlatformLabel`, ...).
- `src/types.ts` — tipi condivisi. `src/styles.css` — stile globale.
- Parla al BE via HTTP. Build servito dal container `frontend` (nginx, porta 3002).

### BE — `backend/`
- `app/api.py` — FastAPI: endpoint prodotti/tag/source-url/bundle/merge, paginazione `limit`/`offset`.
- `app/api_lookup.py` — endpoint aggiuntivi montati sull'app (`/api/sourceurls/lookup`, usato dal bot per l'anti-duplicato).
- `app/server.py` — **entrypoint uvicorn** (`uvicorn app.server:app`): importa `api` e i moduli che registrano endpoint extra.
- `storage/db.py` — modelli SQLModel (Product, Image, Price, SourceUrl, Tag, Bundle, ...) e `init_db()`.
- `start.sh` — aspetta il DB, `init_db()`, avvia **solo** uvicorn. (Il bot non è più qui: vive in `bot/`.)
- `init_db()` usa `create_all` (NON altera tabelle esistenti).

### BOT — `bot/`
- `app/main.py` — bot Telegram: normalizza URL, controlla i duplicati, accoda su Redis, scrapa e riferisce l'esito.
- `app/api_client.py` — **unico punto** di contatto col BE (nessun accesso diretto al DB).
- `app/scrapers/__init__.py` — stati di risultato condivisi: `OK`, `NOT_FOUND`, `ERROR`.
- `app/scrapers/vinted.py` — scrape Vinted con Playwright (`wait_until="domcontentloaded"`); persiste via API.
- `app/scrapers/aliexpress.py` — scrape AliExpress; persiste via API (ritorna bool, normalizzato dal bot).
- `start.sh` — avvia solo il bot (`python -m app.main`).

**Anti-duplicato (due livelli)**
1. prodotto già salvato nel DB → `GET /api/sourceurls/lookup` sul BE;
2. link **ancora in coda o in lavorazione** → set Redis `scrape_pending` (il DB non li vede finché lo scrape non è finito). Il set viene ricostruito dalle code all'avvio, così un URL non resta bloccato dopo un riavvio.

**Esito dello scraping**
Gli scraper ritornano `OK` / `NOT_FOUND` / `ERROR`. `NOT_FOUND` (Vinted risponde 404/410 o serve la pagina "non trovato") diventa un messaggio dedicato all'utente: *annuncio non più disponibile (rimosso o venduto)* — non un errore generico.

**Immagini: solo quelle del prodotto**
Delle immagini si tengono **solo quelle dell'annuncio**. Viene esclusa la foto profilo/avatar del venditore: prima l'unico filtro era l'host + pattern URL (`/t/`, `/f800/`, `/f\d+/`) e l'avatar passava. Ora, oltre a quel filtro, si scartano le immagini dentro il blocco venditore (link `/member/…` o classi con `avatar`/`member`/`seller`/`profile`) e quelle con indizi di avatar in `alt`/`data-testid`/classi; se la pagina espone le foto con `data-testid="item-photo-…"` si considerano solo quelle. Del venditore non viene salvato **nulla**.

**Code**
Liste Redis (`scrape_queue:<sito>`), una per sito, processate in sequenza dal bot (`BETWEEN_SCRAPES_SECONDS` fra uno scrape e il successivo).

### Database
- Postgres (container `db`). Tabelle: `product`, `image`, `price`, `sourceurl`, `tag`, `product_tag_link`, `bundle`, `bundle_product_link`.
- Nessun sistema di migrazioni automatico: lo schema si evolve via nuova versione dell'app.
- **Solo il BE tocca il DB.**

## Flusso Architetturale

1. **Avvio**: `docker compose up -d` → `app` (BE :8004) + `bot` + `frontend` (:3002) + Postgres + Redis.
2. **Scrape**: l'utente manda un link al bot → il bot normalizza → controlla DB (`/api/sourceurls/lookup`) e coda (`scrape_pending`) → se nuovo, accoda su Redis → `vinted.py` (Playwright) → `POST /api/products` + immagini + prezzi + sourceurl.
3. **UI**: frontend chiama `/api/dashboard/products` (paginato) → lista; click → `/api/dashboard/products/{id}` → dettaglio.
4. **Merge**: pagina Unisci → selezione main + da-mergiare → `POST /api/products/merge`.

## Deploy
- URL UI: `http://10.0.0.5:3002` (il bot costruisce i link interni con `BASE_URL` dal `.env`; deve puntare a `10.0.0.5:3002`, non `localhost`).
- Il bot raggiunge il BE con `API_BASE=http://app:8004` (rete compose).
- CI (`.github/workflows/docker-build-push.yml`) costruisce **3 immagini** su push in `main`.
- Modifiche via branch → PR → merge in `main` → `git pull` + `docker compose up -d` nella cartella `/mnt/applicazioni/yml/docker/interesting-items`.
- Volumi condivisi fra BE e bot: `images/`, `tmp/`, `storage_data/` (il BE serve `/media` le immagini scritte dal bot).
- ⚠️ `app_data/` (log degli scraper) **non** è montato: il file di log vive nel container; i log restano comunque visibili su stdout (`docker compose logs bot`).

## Aree da sistemare (paletti da DEVELOPMENT_GUIDELINES)

- 🟡 Paginazione: assicurarsi di non usare cap fissi (`limit: 100`) in `loadProducts`; preferire paginazione/scroll infinito.
- 🟡 Script di sviluppo scraper rimasti in `backend/app/` (`test_vinted.py`, `test_aliexpress.py`, `run_single_scrape.py`, `run_extract_aliexpress_variants.py`): spostarli in `bot/` o eliminarli.
- 🟡 Documentare gli endpoint in modo strutturato (openapi o `.md` API dedicato; da valutare).

## Backlog
Il backlog vive su **Vikunja** (progetto "Interesting items"), etichettato per componente (`FE` / `BE` / `BOT`).
