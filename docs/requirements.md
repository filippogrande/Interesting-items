Requisiti e Scope — Progetto: Web + Telegram Bot per scraping prodotti

Salvataggio del file: `docs/requirements.md` (cartella `docs/` nella root del progetto)

Requisiti e Scope — Progetto: Web + Telegram Bot per scraping prodotti

Scopo: ricevere link prodotto via Telegram, estrarre titolo/descrizione/immagini/prezzi, salvare in DB e sincronizzare con Web UI dove l'utente può modificare manualmente entry e aggiungere prezzi.

Sintesi struttura file:

- `products`: titolo, descrizione, brand, origin_type, metadata, archived flag, timestamps
- `images`: riferite a prodotti con metadata (url/path, size, w/h, checksum)
- `prices`: lista per prodotto con amount, currency, category, added_at, sold, source_url
- `source_urls`/annunci: lista di URL associati al prodotto
- `categories`: entità annidate (parent_id nullable), relazione N:N con prodotti

1. Campi obbligatori e opzionali

- Obbligatori per prodotto:
  - `title` (string)
  - `description` (text)

- Opzionali:
  - `images`: 0..N (nessun limite richiesto)
  - `prices`: 0..N
  - `source_urls`: 0..N
  - `categories`: 0..N (categorie annidate)
  - `brand` e `origin_type` (enum: `marketplace`, `reseller`, `manufacturer`, `third_party`)
  - `archived` (boolean)

2. Prezzi

- Struttura prezzo:
  - `id` (PK), `product_id` (FK)
  - `amount`, `currency` (ISO, default EUR)
  - `category` (enum: `nuovo`, `con_scatola`, `senza_scatola`, `danneggiato`, `in_cattive_condizioni`, `altro`)
  - `added_at`, `sold` (boolean), `source_url` (opzionale)

3. Categorie e tassonomia

- Supporto gerarchia: `categories` ha `parent_id` nullable
- `product_categories` pivot table per relazione N:N

4. Identificatori e chiavi

- `products.id`, `images.id`, `prices.id`, `categories.id` come PK (UUID o serial)
- `source_urls` possono usare `id` PK + indicizzazione su `url`

5. Normalizzazione e qualità dati

- Consigli minimi:
  - `title`: strip HTML, trim, normalize unicode (NFKC)
  - `description`: strip script/iframe, mantenere testo pulito
  - `urls`: canonicalizzazione (rimozione param tracking opzionale)
  - `currency` -> ISO
  - `dates` -> ISO8601 UTC (mostrare in Europe/Rome lato UI)

6. Deduplica e merging

- Dato il basso volume, nessun merge automatico richiesto.
- Possibile rilevazione potenziale duplicati tramite `normalized_title` + hash immagini (opzionale, attivabile dopo).

7. Rate-limiting e retry

- Default consigliato:
  - Delay per dominio: 3s (configurabile)
  - Retry: 1 retry per errore transitorio; log e notifica su errore persistente

8. Bot Telegram (comportamento)

- Modalità iniziale: debug — risposte e anteprime ai messaggi dell'utente (es. "ricevuto URL, in coda")
- Polling per sviluppo; webhook consigliato in produzione per risparmiare risorse
- In caso di errore di scraping inviare messaggio Telegram con tipo di errore

9. Storage e prestazioni

- Dati strutturati: Postgres (raccomandato)
- Immagini: object storage (S3 o compatibile); in locale filesystem per sviluppo
- UX: IndexedDB sul client per sincronizzazione e esperienza reattiva
- Minimizzare risorse in idle: worker on-demand o serverless; API asincrone leggere

10. Sicurezza e legalità

- Non bypassare robots.txt o ToS; usare API ufficiali se disponibili
- Sanitizzazione input/output; proteggere segreti in env vars

11. Operazioni e monitoring

- Logging strutturato, backup DB giornaliero, metriche base (queue length, job fail rate)

12. API minime (MVP)

- `POST /api/products` (crea/aggiorna)
- `GET /api/products` (lista + filtri)
- `GET /api/products/{id}`
- `PUT /api/products/{id}`
- `POST /api/sync-local` (opzionale)

13. Domande aperte (serve la tua conferma)

- Confermi che `title` può non essere univoco e che non vuoi merge automatico?
- Vuoi che `source_url` abbia `url` unico o preferisci `id` + indice su `url`?
- Confermi delay per dominio a 3s e retry=1 come default?
- Vuoi che io implementi subito parsing specifico per Vinted, Wallapop, Subito.it, AliExpress e eBay?
- Confermi che la Web UI rimane non protetta per ora?
- Vuoi esportazione CSV/JSON fin da subito?

---

Ho riorganizzato e semplificato il file: ho rimosso duplicazioni e ho lasciato le domande aperte per te. Dimmi se approvi la versione così e quali risposte dare alle domande aperte; poi procedo con lo step successivo che preferisci (schema SQL o scaffold completo).

16. Requisiti tecnici avanzati e specifiche operative

- API & contratto:
  - Documentare API REST con OpenAPI/Swagger; includere esempi di payload per `POST /api/products` e `PUT /api/products/{id}`.
  - Endpoints per export/import CSV/JSON e per ricerca (full-text).

- Autenticazione & sicurezza API:
  - Supporto opzionale API-key o JWT per proteggere endpoint sensibili se esposti.
  - CORS configurabile; limiti di rate e throttling a livello API gateway/reverse-proxy.

- Rate limits e politeness:
  - Definire rate limit per dominio (default: 1 richiesta ogni 3 secondi; configurabile per dominio)
  - Limit per utente (bot): es. 60 link/ora per singolo utente; configurabile
  - Implementare backoff esponenziale per errori 5xx e stop su 4xx critici

- Estrattori per piattaforme:
  - Per ogni piattaforma creare un parser dedicato con test fixture (Vinted, Wallapop, Subito.it, AliExpress, eBay)
  - Fallback: parser generico basato su meta tags, schema.org, og:image

- Parsing priority & policy:
  - Priorità: schema.org > meta tags > page content
  - Se contenuti dinamici (JS), usare Playwright solo su domini configurati per risparmiare risorse

- Image pipeline:
  - Salvare immagini originali + generare thumbnails (es. 200px, 800px)
  - Supportare formati comuni (jpg, png, webp) e conversione opzionale a WebP
  - Metadati: width, height, size_bytes, checksum
  - Lifecycle: usare regole S3 lifecycle per cleanup/policy se necessario

- Search & indexing:
  - Full-text search con Postgres `tsvector` su `title` e `description`
  - Indici su `source_url`, `created_at`, `archived` e `categories`

- Data model versioning & migrations:
  - Tenere migrations SQL (Alembic/SQLAlchemy) e definire policy di versioning

- Testing:
  - Unit tests per parser e modelli
  - Integration tests per API (DB in-memory/fixture)
  - E2E per UI (Cypress) e per flow bot -> queue -> worker

- Observability & alerting:
  - Log strutturati (JSON) con livelli (info/warn/error)
  - Error tracking (Sentry) e metriche (Prometheus/Grafana o servizi esterni)
  - Alert basici: job-failure-rate > soglia, queue-length alta, errori 5xx ricorrenti

- Backup & recovery:
  - Backup giornaliero del DB; policy retention configurabile
  - Backup o replica per immagini (S3 versione o snapshot)

- CI/CD e deploy:
  - GitHub Actions pipeline: lint, test, build, publish image
  - Dockerfile per backend e frontend; `docker-compose` per dev
  - Raccomandazione deploy: Vercel/Netlify per frontend, Render/Heroku/DigitalOcean/EC2 per backend o container registry + orchestration

- Cost & sizing (stima iniziale):
  - Stimare 100MB-1GB storage immagini/mese a seconda uso; riconsiderare con metriche reali

- Acceptance criteria (minimi per MVP):
  - Ricevere URL via Telegram e salvarne titolo+descrizione+almeno 0 immagini
  - Visualizzare prodotti su UI e modificare titolo/descrizione/prezzi
  - Job queue funzionante con retry=1 e notifica errore su Telegram

- Config/environment variables (minimo):
  - `BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `BASE_URL`, `ENV` (dev/prod), `DEFAULT_CURRENCY`

---

Se vuoi, posso ora generare lo schema SQL dettagliato basato sullo schema suggerito e creare migration iniziali (Alembic) oppure creare subito lo scaffold del progetto. Dimmi quale preferisci.

14. Dettagli aggiuntivi richiesti dall'utente

- Deduplica & identificazione:
  - Dato che il volume sarà basso, la deduplica non è necessaria. Il `title` non deve essere univoco.

- Chiavi primarie e riferimenti:
  - `products`: `id` (UUID/serial) come PK
  - `prices`: `id` (UUID/serial) come PK, `product_id` FK -> `products.id`
  - `images`: `id` (UUID/serial) come PK, `product_id` FK -> `products.id`, `url` o `path`
  - `source_urls`/`annunci`: si può salvare il `url` come identificatore primario (varchar unique) o usare `id` e `url` con indice
  - `categories`: `id` PK, `name`, `parent_id` nullable FK -> `categories.id` per categorie annidate

- Normalizzazione dei dati (consigliata):
  - `title`: rimozione HTML, collapse whitespace, trim, normalizzazione unicode (NFKC), lowercasing opzionale per matching
  - `description`: rimozione di script/iframe, mantenere HTML pulito o plain-text
  - `currency`: mappare a ISO (EUR)
  - `dates`: salvare in ISO8601 UTC; mostrare in `Europe/Rome` lato UI
  - `urls`: canonicalizzazione (rimozione tracking params opzionali)

- Regole di merging:
  - Nessun merge automatico per ora (come richiesto).

- Ritardo per dominio e retry:
  - Ritardo predefinito consigliato: 3 secondi per richiesta al dominio (configurabile)
  - Retry semplice: 1 retry per errore transitorio; usare backoff se aumenti i retry in futuro

- Error reporting:
  - Se uno job di scraping fallisce, inviare un messaggio su Telegram all'utente che ha inviato il link con tipo di errore e codice (es. "Scrape error: timeout, retry=1")

- Marca / origine prodotto:
  - Aggiungere campo `brand` (string) e `origin_type` (enum: `marketplace`, `reseller`, `manufacturer`, `third_party`) per distinguere prodotto originale vs copy/marketplace

- Categorie annidate:
  - Supportare gerarchia (parent_id nullable). Esempio: `toys` -> `lego` -> `star_wars`.

15. Esempio minimale di schema (suggerimento)

- products(id PK, title, description, brand, origin_type, metadata JSON, archived boolean, scraped_at, created_at, updated_at)
- images(id PK, product_id FK, filename, width, height, size_bytes)
- prices(id PK, product_id FK, amount, currency, category, added_at, sold boolean)
- source_urls(url PK, product_id FK, added_at)
- categories(id PK, name, slug, parent_id FK nullable, metadata JSON)
- product_categories(product_id FK, category_id FK) -- relazione N:N

---

Ho aggiunto questi dettagli al file `docs/requirements.md`. Vuoi che ora generi lo schema SQL dettagliato e le migration (opzione raccomandata) oppure preferisci che proceda direttamente con lo scaffold del progetto?
