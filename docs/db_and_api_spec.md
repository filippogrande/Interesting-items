> ⚠️ **DOCUMENTO STORICO** — Specifica tecnica di design dell'MVP, scritta all'avvio del progetto.
> Non descrive lo stato attuale: gli endpoint `POST /api/scrape` e `POST /api/sync-local`
> **non sono implementati**, il job contract RQ **non è in uso** (la coda è su liste Redis gestite
> dal bot), S3 e IndexedDB **non** sono usati, le migration Alembic **non** sono in uso.
> Schema effettivo: `backend/storage/db.py`. Endpoint reali: `backend/app/API_DOCUMENTATION.md`.
> Struttura attuale: `PROJECT_ARCHITECTURE.md`.

---

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

-- Full text index for search
ALTER TABLE products ADD COLUMN search_vector tsvector;
CREATE INDEX idx_products_search ON products USING GIN (search_vector);

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
  - **Stato attuale**: Alembic non è in uso; lo schema è creato con `create_all`.

5. API Design (REST) — autenticazione: none for MVP
   Base path: `/api`

5.A API Surface (endpoints rilevanti per web + bot)

- POST /api/scrape
  - descrizione: enqueue scraping job (usato dal bot o UI)
  - **NON IMPLEMENTATO**: l'accodamento avviene nel bot, su liste Redis.

- GET /api/products
  - descrizione: elenco minimale per lista/ricerca
  - query params: `q`, `category`, `archived`, `limit`, `offset`, `sort`

- GET /api/products/{id}
  - descrizione: dettaglio prodotto completo

- GET /api/products/{id}/prices
  - descrizione: storico prezzi per grafico

- POST /api/products/{id}/source_urls
  - body: { "url": "https://..." }

- DELETE /api/products/{id}/source_urls/{source_id}
  - descrizione: rimuove link sorgente non valido

- POST /api/products/{id}/prices
  - body: { "amount": 12.34, "currency":"EUR", "price_category":"usato", "condition":"usato", "platform":"..." }

- PATCH /api/prices/{price_id}
  - body examples: { "sold": true } oppure partial updates

- PATCH /api/products/{id}
  - body: partial product fields (title, description, category_id, metadata, archived)

- POST /api/sync-local
  - descrizione: bulk create/update/delete per sincronizzazione client offline
  - **NON IMPLEMENTATO**: il FE non usa IndexedDB e non c'è sync offline.

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

- Scopo: creare un prodotto
- Body (example):
  {
  "title": "Nintendo Switch",
  "description": "Buono stato",
  "brand": "Nintendo",
  "origin_type": "reseller"
  }
- Response: 201 Created with created product object
- Errors: 400 on validation

5.2 GET /api/products

- Query params: `q`, `limit`, `offset`
- **Stato attuale**: la risposta è una lista semplice (non `{ items, total }`).

5.3 GET /api/products/{id}

- Response: product object or 404

5.4 PATCH /api/products/{id}

- Body: partial product fields
- Response: 200 updated product

5.5 DELETE /api/products/{id}

- Hard delete (cancella anche immagini/prezzi/link/tag)
- Response: 204 No Content

5.6 POST /api/scrape

- **NON IMPLEMENTATO** (vedi sopra)

5.7 POST /api/sync-local

- **NON IMPLEMENTATO** (vedi sopra)

6. Job contract & responses

- **Stato attuale**: NON esiste un job contract RQ. Il bot tiene una coda **Redis** per sito
  (`scrape_queue:<sito>`) e la processa in sequenza al proprio interno; su errore notifica
  l'utente su Telegram con il tipo di errore.

7. Error model

- 400 Bad Request: validation errors {"detail": [...]}
- 404 Not Found
- 409 Conflict (opzionale: non usato)
- 500 Internal Server Error

8. OpenAPI / Examples

- FastAPI genera automaticamente OpenAPI; usare `response_model`.

9. Acceptance tests (minimi)

- Unit tests per parsing HTML -> expected title/description/images for a set of fixtures
- Integration test: mandare un link al bot -> il bot scrapa -> il DB contiene il prodotto
- API tests: CRUD endpoints

10. Note operative

- S3 non è in uso: le immagini stanno su filesystem (volume condiviso BE/BOT).
- L'API non è autenticata (uso personale).
