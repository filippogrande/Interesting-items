DB & API Specification — Product Scraper

Questo documento contiene la specifica tecnica dettagliata per il database e per le API REST dell'MVP.

1. Enum e convenzioni

- `origin_type`: `marketplace`, `reseller`, `manufacturer`, `third_party`
- `price_category`: `nuovo`, `con_scatola`, `senza_scatola`, `danneggiato`, `in_cattive_condizioni`, `altro`
  -- `condition` (item physical condition): valori consigliati — `nuovo`, `con_scatola`, `senza_scatola`, `danneggiato`, `in_cattive_condizioni`, `altro`.
  - `condition` descrive lo stato fisico dell'articolo; è salvato insieme al prezzo (`prices.condition`) come `item_condition`.
- Date/time: salvare in UTC (TIMESTAMP WITH TIME ZONE). Mostrare in UI in `Europe/Rome`.
- Currency: ISO 4217 (default `EUR`).

2. Schema SQL (Postgres compatible) — DDL suggerito

CREATE TYPE item_condition AS ENUM ('nuovo', 'con_scatola', 'senza_scatola', 'danneggiato', 'in_cattive_condizioni', 'altro');

CREATE TABLE products (
id SERIAL PRIMARY KEY,
title TEXT NOT NULL,
description TEXT NOT NULL,
brand VARCHAR(255),
origin_type VARCHAR(50),
metadata JSONB,
category_id INTEGER REFERENCES categories(id),
archived BOOLEAN DEFAULT FALSE,
scraped_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- images
CREATE TABLE images (
id SERIAL PRIMARY KEY,
product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
filename TEXT,
width INTEGER,
height INTEGER,
size_bytes INTEGER,
checksum VARCHAR(128)
);

-- prices
CREATE TABLE prices (
id SERIAL PRIMARY KEY,
product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
amount NUMERIC(12,2) NOT NULL,
currency CHAR(3) NOT NULL DEFAULT 'EUR',
price_category VARCHAR(50),
condition item_condition,
platform VARCHAR(200),
added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
sold BOOLEAN DEFAULT FALSE
);

-- source_urls
CREATE TABLE source_urls (
id SERIAL PRIMARY KEY,
product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
url TEXT NOT NULL,
domain VARCHAR(255),
added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_source_urls_url ON source_urls (url);

-- categories
CREATE TABLE categories (
id SERIAL PRIMARY KEY,
name VARCHAR(200) NOT NULL,
slug VARCHAR(200),
parent_id INTEGER REFERENCES categories(id),
metadata JSONB
);

-- product_categories (pivot N:N)
-- (removed) products now reference `categories` via `products.category_id` (1:many)

-- Full text index for search
ALTER TABLE products ADD COLUMN search_vector tsvector;
CREATE INDEX idx_products_search ON products USING GIN (search_vector);

-- Trigger to update search_vector (example using pg_trgm/tsvector)
-- (Implement trigger/function in migration)

3. Indici e vincoli raccomandati

- index su `products.created_at`, `products.updated_at`, `products.archived`
- index su `source_urls.url` e `images.checksum`
- unique constraint: none by default (title non univoco); `source_urls` unique per (product_id,url) se desiderato

4. Migrazioni

- Usare Alembic con SQLModel/SQLAlchemy ORM. Creare initial migration che applica DDL sopra.
  - Policy: ogni modifica al modello deve avere migration, test di migrazione e rollback documentato.
  - Nota: lo schema non include più il tipo `product_status`. Se una versione precedente del DB lo contiene,
    la migration iniziale deve evitare di ricrearlo o gestire il DROP/ALTER necessario; usare `alembic revision --autogenerate`
    con attenzione e verificare manualmente gli script generati.

5. API Design (REST) — autenticazione: none for MVP
   Base path: `/api`

5.A API Surface (endpoints rilevanti per web + bot)

- POST /api/scrape
  - descrizione: enqueue scraping job (usato dal bot o UI)
  - body: { "url": "https://...", "notify_user": true }
  - response: 202 Accepted
    { "job_id": "<rq-job-id>", "status": "queued" }

- GET /api/products
  - descrizione: elenco minimale per lista/ricerca
  - query params: `q`, `category`, `archived`, `limit`, `offset`, `sort`
  - response: { "items": [{ "id", "title", "thumbnail_filename", "category", "avg_price" }], "total": 123 }

- GET /api/products/{id}
  - descrizione: dettaglio prodotto completo
  - response: product object (vedi schema sotto)

- GET /api/products/{id}/prices
  - descrizione: storico prezzi per grafico
  - response: [{ "id", "amount", "currency", "price_category", "condition", "platform", "added_at", "sold" }, ...]

- POST /api/products/{id}/source_urls
  - body: { "url": "https://..." }
  - response: 201 { "id": <source_id>, "url": "..." }

- DELETE /api/products/{id}/source_urls/{source_id}
  - descrizione: rimuove link sorgente non valido
  - response: 204 No Content

- POST /api/products/{id}/prices
  - body: { "amount": 12.34, "currency":"EUR", "price_category":"usato", "condition":"usato", "platform":"..." }
  - response: 201 created price object

- PATCH /api/prices/{price_id}
  - body examples: { "sold": true } oppure partial updates
  - response: 200 updated price

- PATCH /api/products/{id}
  - body: partial product fields (title, description, category_id, metadata, archived)
  - response: 200 updated product

- POST /api/sync-local
  - descrizione: bulk create/update/delete per sincronizzazione client offline
  - body: { "changes": [ {"op":"create|update|delete","type":"product|price|source_url", "payload":{...}} ] }
  - response: merged results, conflicts if any

Nota: preferire endpoint piccoli e mirati per le azioni utente (PATCH per singole modifiche). Usare bulk endpoints (`/api/sync-local`) solo per sync/import.

Common models (JSON)
Product (response):
{
"id": 123,
"title": "My product",
"description": "...",
"brand": "LEGO",
"origin_type": "marketplace",
"metadata": { },
"archived": false,
"scraped_at": "2026-02-09T12:00:00Z",
"created_at": "2026-02-09T12:00:00Z",
"updated_at": "2026-02-09T12:00:00Z",
"images": [{"id":1, "filename":"/media/images/1.jpg"}],
"prices": [{"id":1, "amount":10.00, "currency":"EUR", "price_category":"usato", "condition":"usato", "platform":"example_marketplace"}],
"source_urls": [{"id":1, "url":"https://..."}],
"category": {"id":1, "name":"lego"}
}

5.1 POST /api/products

- Scopo: creare un prodotto o aggiornare esistente (upsert by id optional)
- Body (example):
  {
  "title": "Nintendo Switch",
  "description": "Buono stato",
  "brand": "Nintendo",
  "origin_type": "reseller",
  "source_urls": ["https://..."],
  "images": ["https://.../img1.jpg"]
  }
- Response: 201 Created with created product object
- Errors: 400 on validation

  5.2 GET /api/products

- Query params: `q` (fulltext), `category`, `archived`, `limit`, `offset`, `sort`
- Response: { "items": [...], "total": 123 }

  5.3 GET /api/products/{id}

- Response: product object or 404

  5.4 PUT /api/products/{id}

- Body: partial or full product fields
- Response: 200 updated product

  5.5 DELETE /api/products/{id}

- Soft-delete (set archived=true) or hard delete param
- Response: 204 No Content

  5.6 POST /api/scrape

- Scopo: enqueue scraping job (alternative to Telegram)
- Body: { "url": "https://...", "notify_user": true }
- Response: 202 Accepted { "job_id": "..." }

  5.7 POST /api/sync-local

- Scopo: sincronizzare modifiche dal client IndexedDB
- Body: payload with list of local changes (create/update/delete) with client-generated temp ids
- Response: merged results, conflicts if any

6. Job contract & responses

- Enqueue response: { "job_id": "<rq-job-id>", "status": "queued" }
- Worker must update DB and, on error, send Telegram message to original sender (if sender_id provided)
- Error payload example (Telegram message): "Errore scraping: timeout after 1 retry"

7. Error model

- 400 Bad Request: validation errors {"detail": [{"loc": [...], "msg": "...", "type": "value_error"}]}
- 404 Not Found
- 409 Conflict (optional: merge conflicts during sync)
- 500 Internal Server Error

8. OpenAPI / Examples

- FastAPI genera automaticamente OpenAPI; definire pydantic/sqlmodel schemas per request/response e usare `response_model`.
- Includere esempi concreti per POST /api/products e POST /api/scrape nelle docstrings per generare esempi nella UI OpenAPI.

9. Acceptance tests (minimi)

- Unit tests per parsing HTML -> expected title/description/images for a set of fixtures
- Integration test: POST /api/scrape -> worker processes job -> DB contains product
- API tests: CRUD endpoints (pytest + test database)

10. Note operative

- Se si decide in futuro di usare S3, salvare in DB solo il percorso pubblico o chiave oggetto.
- Se si abilita autenticazione: proteggere endpoint `POST /api/scrape` e `POST /api/products` se esposto pubblicamente.

---

File pronto per essere tradotto in Alembic migrations e in schemi pydantic/SQLModel per FastAPI.
