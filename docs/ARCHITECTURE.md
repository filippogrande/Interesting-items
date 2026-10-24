# ARCHITECTURE — come funziona Interesting Items

<!-- Tipo: EXPLANATION. Come funziona e perche'. I fatti "dove vive" stanno in docs/REFERENCE.md. -->

## Componenti (3, separati)

Il progetto e' diviso in tre componenti indipendenti, con codice, immagine Docker e
container propri. Regola d'oro: **il BE e' l'unico proprietario del database**; FE e bot
parlano al BE **solo via HTTP**.

```
frontend/   -> FE  (React + Vite + nginx)        immagine: ...:frontend-latest
backend/    -> BE  (FastAPI + SQLModel)        immagine: ...:backend-latest
bot/        -> BOT (Telegram + scraper)          immagine: ...:bot-latest
```

Motivo della separazione: BE e bot erano nello stesso container e sulla stessa immagine,
con parte del bot che scriveva direttamente sul DB. Questo impediva deploy e test
indipendenti e mescolava le responsabilita'. Oggi il bot ha un solo punto di contatto col
BE (`bot/app/api_client.py`).

### FE — `frontend/`
React + Vite + TypeScript, build servita da nginx. Parla al BE via HTTP.

- `src/main.tsx` — **orchestratore**: compone gli hook e rende la vista attiva.
- `src/hooks/` — logica di stato: `useProducts`, `useProductDetail`, `useMerge`,
  `useBundles`, `useTags`, `useSourceWebsites`.
- `src/components/` — UI: `ProductDetailPanel`, `MergeView`, `TagsView`, `SourcesView`,
  `ProductCard`, `CreationModal`, `LightboxViewer`, `Stats`.
- `src/utils/format.ts` — helper (`fetchJson`, `formatDate`, `formatMoney`,
  `derivePlatformLabel`, ...).
- `nginx.conf` — proxy `/api/` e `/media/` verso `http://app:8004`.

### BE — `backend/`
Python + FastAPI + SQLModel. **Unico proprietario del DB.** Serve l'API REST.

- `app/api.py` — tutti gli endpoint + i modelli pydantic di request/response.
- `app/api_lookup.py` — `/api/sourceurls/lookup`, usato dal bot per l'anti-duplicato.
- `app/server.py` — **entrypoint uvicorn** (`uvicorn app.server:app`): importa `api` e i
  moduli che registrano endpoint extra.
- `storage/db.py` — modelli SQLModel e `init_db()`.
- `start.sh` — aspetta il DB, `init_db()`, avvia **solo** uvicorn.

### BOT — `bot/`
Python + aiogram (polling) + Playwright/BeautifulSoup. **Non accede al DB**: parla al
BE via HTTP.

- `app/main.py` — handler Telegram e orchestrazione.
- `app/api_client.py` — **unico punto** di contatto col BE.
- `app/queue_store.py` — code e stato pending su Redis.
- `app/worker.py` — consuma le code, un task per sito, con watchdog.
- `app/messaging.py` — testi dei messaggi; `app/durations.py` — stime e pause.
- `app/scrapers/` — `vinted.py`, `aliexpress.py`, stati condivisi in `__init__.py`.
- `start.sh` — avvia solo il bot (`python -m app.main`).

## Flusso

1. **Avvio**: `docker compose up -d` -> `app` (BE :8004) + `bot` + `frontend` (:3002)
   + Postgres + Redis. `backend/start.sh` crea le tabelle con `init_db()`.
2. **Scrape**: l'utente manda un link al bot -> il bot normalizza l'URL
   (`normalize_url()`) -> controlla i duplicati -> se nuovo, accoda su Redis e
   avvia il worker del sito.
3. **Scraping**: `worker.py` preleva l'item e chiama `scrape_<sito>()` in un thread;
   l'esito e' `OK` / `NOT_FOUND` / `ERROR`; il prodotto e' persistito via API del BE.
4. **UI**: il frontend chiama `/api/dashboard/products` (paginato) -> lista; click ->
   `/api/dashboard/products/{id}` -> dettaglio.
5. **Merge**: pagina Unisci -> selezione main + da-mergiare -> `POST /api/products/merge`.

## Anti-duplicato (due livelli)

1. prodotto gia' salvato nel DB -> `GET /api/sourceurls/lookup` sul BE;
2. link **ancora in coda o in lavorazione** -> set Redis `scrape_pending`: il DB non li
   vede finche' lo scrape non e' finito.

Il set viene ricostruito dalle code all'avvio (`rebuild_pending_set()`), cosi' un URL non
resta bloccato dopo un riavvio.

## Code

Liste Redis (`scrape_queue:<sito>`), una per sito, processate in sequenza dal bot. La pausa
fra uno scrape e il successivo e' configurabile (`BETWEEN_SCRAPES_SECONDS`, default 20s) e
non si applica quando la coda e' vuota. Se il worker muore, un watchdog lo rilancia finche'
la coda non e' vuota.

## Ripresa delle code all'avvio (attenzione aiogram v3)

L'hook di avvio e' registrato con `dp.startup.register(on_startup)`. In aiogram v3 **non** va
passato a `start_polling` (il parametro viene ignorato): se lo si fa, il bot non notifica
l'avvio e soprattutto **non riprende le code in Redis**, che restano piene e mute dopo un
riavvio finche' non arriva un nuovo link. Alla startup il bot: notifica gli utenti,
ricostruisce `scrape_pending`, riavvia la lavorazione delle code non vuote. I log di avvio
vanno su **stdout** (`docker compose logs bot`).

## Esito dello scraping

Gli scraper ritornano `OK` / `NOT_FOUND` / `ERROR`. `NOT_FOUND` (Vinted risponde 404/410 o
serve la pagina "non trovato") diventa un messaggio dedicato all'utente: *annuncio non piu'
disponibile (rimosso o venduto)* — non un errore generico.

## Immagini: solo quelle del prodotto

Delle immagini si tengono **solo quelle dell'annuncio**. Viene esclusa la foto
profilo/avatar del venditore: oltre al filtro per host + pattern URL, si scartano le
immagini dentro il blocco venditore (link `/member/...` o classi con `avatar`/`member`/
`seller`/`profile`) e quelle con indizi di avatar in `alt`/`data-testid`/classi. Del venditore
non viene salvato **nulla**.

## Database

- Postgres 15 in produzione (container `db`); SQLite come fallback locale
  (`backend/storage/db.py` sceglie in base a `DATABASE_URL`).
- Tabelle: `product`, `image`, `price`, `sourceurl`, `tag`, `product_tag_link`, `bundle`,
  `bundle_product_link`, `category`.
- **Nessun sistema di migrazioni automatico**: lo schema si evolve via nuova versione
  dell'app. `init_db()` usa `create_all`, che **NON** aggiunge colonne a tabelle esistenti.
- **Solo il BE tocca il DB.**

## Storage immagini

Filesystem locale su volume **condiviso fra BE e BOT** (`images/`). Il BOT scarica le
immagini, il BE le serve su `/media`.

## Stack e scelte

- BE: FastAPI (OpenAPI/Swagger su `/docs`), ORM SQLModel (su SQLAlchemy), uvicorn.
  Alembic e' tra le dipendenze ma **le migration non sono in uso**.
- BOT: aiogram (polling, non webhook), Playwright (Chromium headless) per Vinted e
  AliExpress, BeautifulSoup per il parsing. `requests` da solo non basta: i marketplace
  rendono il contenuto via JS.
- FE: React + Vite + TypeScript; `idb` e' tra le dipendenze ma il client usa solo il BE.
- Code: Redis con liste (l'ex RQ worker e' stato rimosso: nessuno accodava job RQ).
- Non implementato (idee del design iniziale): object storage S3, IndexedDB, endpoint
  `POST /api/scrape` e `POST /api/sync-local`, full-text search `tsvector`, migration
  Alembic, webhook Telegram.
