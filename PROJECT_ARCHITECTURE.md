# Architettura Interesting Items

> Mappa della struttura reale del progetto. Coerente con `DEVELOPMENT_GUIDELINES.md`.
> Ultimo aggiornamento: 14 settembre 2026

## Struttura del Progetto

### Root (config & deploy)
- `docker-compose.yml` — container bot/app/redis/frontend/db
- `frontend/Dockerfile` — build frontend (Node 22, Vite 8)
- `.env` / `.env.example` — variabili ambiente (incl. `BASE_URL` del bot)

### Backend (`backend/`)
- `app/api.py` — FastAPI: endpoint prodotti/tag/source-url/bundle/merge, paginazione `limit`/`offset`
- `app/bot.py` — bot Telegram: normalizza URL, check `SourceUrl` (anti-dup), accoda
- `app/vinted.py` — scrape Vinted con Playwright (`wait_until="domcontentloaded"`)
- `storage/db.py` — modelli SQLModel (Product, Image, Price, SourceUrl, Tag, Bundle, ...)
- `init_db()` usa `create_all` (NON altera tabelle esistenti)

### Database
- Postgres (container `db`). Tabelle principali: `product`, `image`, `price`, `sourceurl` (colonne: id, product_id, url, domain, added_at), `tag`, `product_tag_link`, `bundle`, `bundle_product_link`.
- Nessun sistema di migrazioni automatico: lo schema si evolve via nuova versione dell'app.

### Frontend (`frontend/`)
- `src/main.tsx` — **orchestratore**: `App()` compone gli hook e rende la vista in base alla tab attiva (dashboard/tags/sources/merge). File snello (~400 righe).
- `src/hooks/` — logica di stato estratta: `useProducts`, `useProductDetail`, `useMerge`, `useBundles`, `useTags`, `useSourceWebsites`.
- `src/components/` — componenti UI: `ProductDetailPanel`, `MergeView`, `TagsView`, `SourcesView`, `ProductCard`, `CreationModal`, `LightboxViewer`, `Stats` (StatCard/Kpi).
- `src/utils/format.ts` — helper formattazione (`fetchJson`, `formatDate`, `formatMoney`, `derivePlatformLabel`, `makeEmptyPrice`, ...).
- `src/types.ts` — tipi condivisi (`ProductSummary`, `ProductDetail`, `Tag`, `SourceWebsite`).
- `src/styles.css` — stile globale (classi `.panel`, `.product-card`, `.kpi`, `.error-box`, ...).
- Vite + React + TypeScript; build servito dal container `frontend` (nginx).

## Flusso Architetturale

1. **Avvio**: `docker compose up -d` → bot + app (FastAPI :8004) + Postgres + Redis + frontend (:3002 nginx)
2. **Scrape**: bot riceve URL → normalizza → check `SourceUrl` nel DB → se nuovo, accoda → `vinted.py` (Playwright) → `POST /api/products` + immagini + prezzi + sourceurl
3. **UI**: frontend chiama `/api/dashboard/products` (paginato) → lista; click → `/api/dashboard/products/{id}` → dettaglio
4. **Merge**: pagina Unisci → selezione main + da-mergiare → `POST /api/products/merge`

## Deploy
- URL UI: `http://10.0.0.5:3002` (il bot costruisce i link interni con `BASE_URL` dal `.env`; deve puntare a `10.0.0.5:3002`, non `localhost`).
- Modifiche via branch → PR → merge in `main` → `git pull` + `docker compose up -d` nella cartella `/mnt/applicazioni/yml/docker/interesting-items`.

## Aree da sistemare (paletti da DEVELOPMENT_GUIDELINES)

- 🟡 Paginazione: assicurarsi di non usare cap fissi (`limit: 100`) in `loadProducts`; preferire paginazione/scroll infinito.
- 🟡 Card prodotto: `ProductCard` riusabile estratto e usato sia nella lista sia nel merge (verificare che non ci siano copie a mano).
- 🟢 Documentare gli endpoint in modo strutturato (openapi o `.md` API dedicato; da valutare).

## Backlog
Il backlog di feature e task di refactor/cleanup è su **TickTick** (progetto "Interesting items"). Qui solo i paletti riassunti da `DEVELOPMENT_GUIDELINES.md`.
