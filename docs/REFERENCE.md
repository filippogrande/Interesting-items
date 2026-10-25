# REFERENCE — la mappa del codice

<!-- Tipo: REFERENCE. Fatti, neutro, completo. Specchia la struttura del codice, come una mappa. -->
<!-- Ogni riga: un file reale + un simbolo reale. Nessun numero di riga. -->
<!-- Si aggiorna NELLA STESSA PR che sposta qualcosa. -->

## Come si legge

Una riga per cosa potresti dover cambiare. **Richiesta -> file -> simbolo.**
Se serve piu' di questo per trovare il file, la riga e' sbagliata.

- [BE: entrypoint e modelli](#be)
- [API: endpoint -> handler](#api)
- [BOT: handler, coda, worker, scraper](#bot)
- [FE: entrypoint, hook, componenti](#frontend)
- [Infra e deploy](#infra-e-deploy)
- [Limiti noti (file oltre i paletti)](#limiti-noti)

## BE

| Vuoi... | File | Simbolo |
|---|---|---|
| Entry point uvicorn | `backend/app/server.py` | `app` |
| Registrare un endpoint extra sull'app | `backend/app/api_lookup.py` | `lookup_sourceurl()` |
| Modelli del DB | `backend/storage/db.py` | `Product`, `Image`, `Price`, `SourceUrl`, `Tag`, `Category`, `Bundle`, `ProductTagLink`, `BundleProductLink` |
| Enum del DB | `backend/storage/db.py` | `TagKind`, `ItemCondition` |
| Creare le tabelle al primo avvio | `backend/storage/db.py` | `init_db()` |
| Motore del DB (Postgres, o SQLite come fallback) | `backend/storage/db.py` | `engine`, `DB_URL` |
| Avvio del BE: crea le tabelle | `backend/app/api.py` | `on_startup()` |
| Serializzare un prodotto in lista | `backend/app/api.py` | `_serialize_summary()` |
| Serializzare il dettaglio completo | `backend/app/api.py` | `_serialize_detail()` |
| Derivare l'etichetta della piattaforma | `backend/app/api.py` | `_label_from_host()`, `_product_source_labels()` |
| Aggiungere gli ancestor a un tag | `backend/app/api.py` | `_collect_ancestor_tag_ids()` |
| Escludere i discendenti di un tag | `backend/app/api.py` | `_collect_descendant_tag_ids()` |
| URL pubblico di un'immagine | `backend/app/api.py` | `_to_media_url()` |
| Montare il volume immagini | `backend/app/api.py` | `IMAGES_DIR`, `app.mount("/media", ...)` |

## API

Tutte le rotte stanno in `backend/app/api.py`, tranne `/api/sourceurls/lookup`
(`backend/app/api_lookup.py`). Base URL: `http://localhost:8004`; nella rete compose il
BE e' `http://app:8004`. Swagger: `/docs`.

| Endpoint | File | Handler |
|---|---|---|
| `GET /api/products` | `backend/app/api.py` | `list_products()` |
| `POST /api/products` | `backend/app/api.py` | `create_product()` |
| `GET /api/products/{product_id}` | `backend/app/api.py` | `get_product()` |
| `PATCH /api/products/{product_id}` | `backend/app/api.py` | `update_product()` |
| `DELETE /api/products/{product_id}` | `backend/app/api.py` | `delete_product()` |
| `POST /api/products/{product_id}/duplicate` | `backend/app/api.py` | `duplicate_product()` |
| `POST /api/products/merge` | `backend/app/api.py` | `merge_products()` |
| `GET /api/dashboard/products` | `backend/app/api.py` | `dashboard_products()` |
| `GET /api/dashboard/products/untagged` | `backend/app/api.py` | `dashboard_products_untagged()` |
| `GET /api/dashboard/products/{product_id}` | `backend/app/api.py` | `dashboard_product()` |
| `GET /api/products/{product_id}/images` | `backend/app/api.py` | `get_product_images()` |
| `POST /api/products/{product_id}/images/upload` | `backend/app/api.py` | `upload_product_image()` |
| `POST /api/images` | `backend/app/api.py` | `create_image()` |
| `PATCH /api/images/{image_id}` | `backend/app/api.py` | `update_image()` |
| `DELETE /api/images/{image_id}` | `backend/app/api.py` | `delete_image()` |
| `GET /api/products/{product_id}/prices` | `backend/app/api.py` | `get_product_prices()` |
| `POST /api/prices` | `backend/app/api.py` | `create_price()` |
| `PATCH /api/prices/{price_id}` | `backend/app/api.py` | `update_price()` |
| `DELETE /api/prices/{price_id}` | `backend/app/api.py` | `delete_price()` |
| `GET /api/products/{product_id}/source_urls` | `backend/app/api.py` | `get_product_source_urls()` |
| `POST /api/sourceurls` | `backend/app/api.py` | `create_sourceurl()` |
| `PATCH /api/sourceurls/{source_id}` | `backend/app/api.py` | `update_sourceurl()` |
| `DELETE /api/sourceurls/{source_id}` | `backend/app/api.py` | `delete_sourceurl()` |
| `GET /api/sourceurls/lookup` | `backend/app/api_lookup.py` | `lookup_sourceurl()` |
| `GET /api/tags` | `backend/app/api.py` | `list_tags()` |
| `POST /api/tags` | `backend/app/api.py` | `create_tag()` |
| `GET /api/tags/stats` | `backend/app/api.py` | `tags_stats()` |
| `PATCH /api/tags/{tag_id}` | `backend/app/api.py` | `update_tag()` |
| `DELETE /api/tags/{tag_id}` | `backend/app/api.py` | `delete_tag()` |
| `PUT /api/products/{product_id}/tags` | `backend/app/api.py` | `set_product_tags()` |
| `POST /api/products/{product_id}/tags/{tag_id}` | `backend/app/api.py` | `add_product_tag()` |
| `DELETE /api/products/{product_id}/tags/{tag_id}` | `backend/app/api.py` | `remove_product_tag()` |
| `GET /api/sourcewebsites/stats` | `backend/app/api.py` | `source_websites_stats()` |
| `GET /api/bundles` | `backend/app/api.py` | `list_bundles()` |
| `GET /api/products/{product_id}/bundles` | `backend/app/api.py` | `get_product_bundles()` |
| `POST /api/bundles` | `backend/app/api.py` | `create_bundle()` |
| `POST /api/categories` | `backend/app/api.py` | `create_category()` |

Schema delle richieste/risposte (modelli pydantic in `backend/app/api.py`):
`ProductSummaryOut`, `ProductDetailOut`, `ProductMergeIn`, `ProductDuplicateIn`,
`BundleCreateIn`, `BundleOut`, `ImageOut`, `PriceOut`, `SourceUrlOut`, `TagOut`,
`TagWithCount`, `TagsStatsOut`, `SourceWebsiteOut`, `SourceWebsitesStatsOut`,
`ProductTagAssignmentIn`. In `backend/app/api_lookup.py`: `SourceUrlLookupOut`.

Errori: `400` richiesta non valida, `404` risorsa assente, `422` validazione pydantic.
L'id di un prodotto e' **sempre** generato dal DB (un id passato viene ignorato).

## BOT

Entry point: `bot/app/main.py` -> `run_polling()` (avviato da `bot/start.sh` con
`python -m app.main`).

### Handler e flusso del messaggio

| Vuoi... | File | Simbolo |
|---|---|---|
| Avviare il bot (polling) | `bot/app/main.py` | `run_polling()` |
| Handler del messaggio con i link | `bot/app/main.py` | `handle_message()` |
| `/start` e `/help` | `bot/app/main.py` | `cmd_start()` |
| Normalizzare un URL (utm_*, fbclid, case, porta) | `bot/app/main.py` | `normalize_url()` |
| Decidere a che sito appartiene un URL | `bot/app/main.py` | `get_site_type()` |
| Filtrare i domini accettati | `bot/app/main.py` | `is_allowed_domain()`, `build_allowed_domains()` |
| Filtrare gli utenti autorizzati | `bot/app/main.py` | `is_authorized()`, `parse_allowed_user_ids()` |
| Avvio: notifica utenti e ripresa code | `bot/app/main.py` | `on_startup()` (registrato con `dp.startup.register`) |
| Domini accettati di default | `bot/app/main.py` | `DEFAULT_ALLOWED_DOMAINS` |
| Client HTTP verso il BE | `bot/app/api_client.py` | `_url()` |
| Anti-duplicato: prodotto gia' nel DB | `bot/app/api_client.py` | `find_existing_product()` |
| Creare un prodotto dal bot | `bot/app/api_client.py` | `create_product()` |
| Aggiungere immagine/prezzo/link dal bot | `bot/app/api_client.py` | `add_image()`, `add_price()`, `add_source_url()` |
| Costruire i link interni (UI + API) | `bot/app/api_client.py` | `internal_product_links()` |

### Coda Redis

| Vuoi... | File | Simbolo |
|---|---|---|
| Accodare un link | `bot/app/queue_store.py` | `enqueue()` |
| Prendere il prossimo item | `bot/app/queue_store.py` | `dequeue()` |
| Chiave Redis della coda di un sito | `bot/app/queue_store.py` | `queue_key()`, `QUEUE_KEY_PREFIX` |
| Stato "in coda / in lavorazione" | `bot/app/queue_store.py` | `PENDING_SET_KEY`, `mark_pending()`, `unmark_pending()`, `is_pending()` |
| Ricostruire i pending dopo un riavvio | `bot/app/queue_store.py` | `rebuild_pending_set()` |
| Dimensione e siti con item | `bot/app/queue_store.py` | `total_queue_size()`, `queue_length()`, `sites_with_items()` |

### Worker e scraper

| Vuoi... | File | Simbolo |
|---|---|---|
| Consumare la coda di un sito | `bot/app/worker.py` | `process_site_queue()` |
| Avviare o riprendere il worker di un sito | `bot/app/worker.py` | `ensure_worker()`, `resume_queues()` |
| Rilanciare un worker morto con coda piena | `bot/app/worker.py` | `start_watchdog()`, `_watchdog()` |
| Scegliere lo scraper da eseguire | `bot/app/worker.py` | `run_scraper()` |
| Uniformare il risultato di uno scraper vecchio (bool) | `bot/app/worker.py` | `_normalize_result()` |
| Numero di tentativi e backoff | `bot/app/worker.py` | `SCRAPE_MAX_ATTEMPTS`, `RETRY_BACKOFF_SECONDS`, `_backoff_after()` |
| Cambiare la pausa fra uno scraping e il successivo | `bot/app/durations.py` | `BETWEEN_SCRAPES_SECONDS` |
| Stimare l'ETA nei messaggi | `bot/app/durations.py` | `estimate_remaining_seconds()`, `format_duration()` |
| Cambiare il testo dei messaggi del bot | `bot/app/messaging.py` | `enqueue_ack()`, `enqueue_summary()`, `item_result()` |
| Scrape di un annuncio Vinted | `bot/app/scrapers/vinted.py` | `scrape_vinted()` |
| Scrape di un annuncio AliExpress | `bot/app/scrapers/aliexpress.py` | `scrape_aliexpress()` |
| Aggiungere uno scraper per un nuovo sito | `bot/app/scrapers/__init__.py` + `bot/app/worker.py` | `OK` / `NOT_FOUND` / `ERROR`; `run_scraper()` |
| Stati di risultato condivisi | `bot/app/scrapers/__init__.py` | `OK`, `NOT_FOUND`, `ERROR` |

## Frontend

Entry point: `frontend/src/main.tsx` -> `App()` (montato da `createRoot()`).
Le chiamate sono relative (`/api/...`): nginx le proxy verso il BE
(`frontend/nginx.conf`, `location /api/`).

| Vuoi... | File | Simbolo |
|---|---|---|
| Comporre hook + vista attiva | `frontend/src/main.tsx` | `App()` |
| Salvare un merge e ricaricare i dati | `frontend/src/main.tsx` | `commitMergeAndRefresh()` |
| Creare un prodotto dal form | `frontend/src/main.tsx` | `createNewProduct()` |
| Aggiungere/togliere un tag da un prodotto | `frontend/src/main.tsx` | `toggleProductTag()` |
| Lista prodotti, filtri, stats | `frontend/src/hooks/useProducts.tsx` | `useProducts()`, `loadProducts()`, `filteredProducts`, `stats` |
| Dettaglio prodotto, edit mode, upload | `frontend/src/hooks/useProductDetail.tsx` | `useProductDetail()`, `loadDetail()`, `duplicateSelectedProduct()`, `uploadProductImage()` |
| Flusso di merge (chooser / editor) | `frontend/src/hooks/useMerge.tsx` | `useMerge()`, `openMergeEditor()`, `commitMerge()`, `mergePhase` |
| Bundle | `frontend/src/hooks/useBundles.tsx` | `useBundles()`, `createBundle()`, `createBundleFromPrice()` |
| Tag: lista, gerarchia, stats | `frontend/src/hooks/useTags.tsx` | `useTags()`, `createTag()`, `getAncestorIds()` |
| Stats dei siti | `frontend/src/hooks/useSourceWebsites.tsx` | `useSourceWebsites()`, `loadSourceWebsitesStats()` |
| Chiamate HTTP al BE | `frontend/src/utils/format.ts` | `fetchJson()` |
| Formattazione date / soldi / etichette | `frontend/src/utils/format.ts` | `formatDate()`, `formatMoney()`, `derivePlatformLabel()`, `labelFromHost()`, `buildTagLabel()` |
| Tipi condivisi | `frontend/src/types.ts` | `ProductSummary`, `ProductDetail`, `Tag`, `SourceWebsite` |
| Pannello dettaglio + edit mode | `frontend/src/components/ProductDetailPanel.tsx` | `ProductDetailPanel` |
| Vista Unisci prodotti | `frontend/src/components/MergeView.tsx` | `MergeView` |
| Vista Tag | `frontend/src/components/TagsView.tsx` | `TagsView` |
| Vista Sorgenti | `frontend/src/components/SourcesView.tsx` | `SourcesView` |
| Card riusabile (lista + merge) | `frontend/src/components/ProductCard.tsx` | `ProductCard` |
| Modale nuovo prodotto | `frontend/src/components/CreationModal.tsx` | `CreationModal` |
| Viewer immagini | `frontend/src/components/LightboxViewer.tsx` | `LightboxViewer` |
| Card e KPI delle stats | `frontend/src/components/Stats.tsx` | `Stats` |
| Proxy `/api/` e `/media/` verso il BE | `frontend/nginx.conf` | `location /api/`, `location /media/` |
| Stile globale | `frontend/src/styles.css` | — |

## Infra e deploy

| Vuoi... | File | Simbolo |
|---|---|---|
| Servizi di produzione | `docker-compose.yml` | `app`, `bot`, `db`, `redis`, `frontend` |
| Postgres e Redis per lo sviluppo locale | `infra/docker-compose.dev.yml` | `postgres`, `redis` |
| Shortcut di sviluppo | `Makefile` | `dev-backend`, `dev-frontend`, `start-bot` |
| Build e push delle 3 immagini | `.github/workflows/docker-build-push.yml` | job `build-and-push` |
| Aggiornamenti automatici delle dipendenze | `.github/dependabot.yml` | 6 ecosistemi (pip x2, npm, docker, docker-compose, github-actions) |
| Immagine BE | `backend/Dockerfile` | — |
| Immagine BOT | `bot/Dockerfile` | — |
| Immagine FE | `frontend/Dockerfile` | — |
| Variabili d'ambiente e comandi | `docs/OPERATIONS.md` | — |

## Limiti noti

File che violano i paletti di `docs/CONVENTIONS.md`. **Non sono stati toccati in questa PR:**
qui si segnalano solo.

- `backend/app/api.py` — 39.875 byte: oltre il limite di 500 righe. Ospita tutti gli
  endpoint + i serializzatori + i modelli pydantic. Da splittare per dominio
  (prodotti / tag / bundle / immagini / prezzi / sourceurl).
- `bot/app/scrapers/aliexpress.py` — 23.547 byte: oltre il limite. Da splittare
  (fetch / parse / persistenza).
- `frontend/src/components/ProductDetailPanel.tsx` — 23.644 byte.
- `frontend/src/components/MergeView.tsx` — 18.550 byte.
- Etichetta della piattaforma duplicata: `backend/app/api.py::_label_from_host()` e
  `frontend/src/utils/format.ts::labelFromHost()`. Stessa logica in due implementazioni che
  divergono: per un host a tre parti (`it.ebay.it`) il BE ritorna `ebay`, il FE `ebay it`.
- `backend/app/main.py` — scaffold FastAPI legacy con solo `root()`: **non** e'
  l'entrypoint (lo e' `backend/app/server.py`). Da rimuovere.
- `frontend/src/components/ProductList.tsx` — non importato da `frontend/src/main.tsx`:
  probabile residuo del refactor. `dashboard.tsx` e `ProductDetail.tsx` vanno
  verificati allo stesso modo.
- Script di debug/prova nel tree (vietati dalle regole): in `backend/app/`
  `test_vinted.py`, `test_aliexpress.py`, `run_single_scrape.py`,
  `run_extract_aliexpress_variants.py`, `export_aliexpress_compact.py`, `filter_images.py`;
  in root `beautify_html.py`, `download_html.py`, `playwright_save_rendered_html.py`.
- Artefatti locali tracciati in `backend/storage/`: `db.sqlite`, `db.sqlite.bak`,
  `db.sqlite.bak.1775250643`, `log.txt`, `db_viewer.py`.
- Paginazione: `useProducts.tsx::loadProducts()` usa `limit: 1000`, non la paginazione
  `limit`/`offset` del BE. Segnalato, non corretto.
- Anti-bot: Vinted va scrapato con Playwright (`wait_until="domcontentloaded"`);
  `networkidle` va in timeout perche' la pagina si ricarica di continuo.
- `get_site_type()` (`bot/app/main.py`) riconosce solo `vinted`, `wallapop` e
  `aliexpress`: i domini accettati `subito.it` ed `ebay.it` arrivano al messaggio
  "sito non supportato". Comportamento attuale, non un bug introdotto.
