# Product Scraper API – Documentazione

API REST del **BE** (`backend/`). Gestisce prodotti, immagini, prezzi, source url, tag, bundle e merge.

> Aggiornata 16 settembre 2026. Il BE è l'**unico** componente che accede al database; il bot (`bot/`) e il FE (`frontend/`) lo chiamano solo via HTTP.

## Base URL

    http://localhost:8004

Dalla rete docker compose il BE è raggiungibile come `http://app:8004`. Swagger UI: `/docs`.

---

## Prodotti

- **GET** `/api/products` — lista (params: `q`, `limit` default 20, `offset`) → lista di Product
- **POST** `/api/products` — crea un prodotto (`201`). L'id è **sempre** generato dal DB (ignorato se passato)
- **GET** `/api/products/{product_id}` — dettaglio (`404` se non trovato)
- **PATCH** `/api/products/{product_id}` — aggiornamento parziale
- **DELETE** `/api/products/{product_id}` — `204`; elimina anche immagini, prezzi, source url e tag collegati
- **POST** `/api/products/{product_id}/duplicate` — duplica il prodotto con immagini/prezzi/link/tag (`201`)

## Dashboard / viste

- **GET** `/api/dashboard/products` — lista paginata
  - params: `q`, `tag_id`, `tag_kind`, `source_site`, `exclude_tag_ids` (lista separata da virgole), `exclude_source`, `limit`, `offset`
  - risposta: `ProductSummaryOut[]` (conteggi immagini/prezzi/tag/bundle, cover, ultimo prezzo)
- **GET** `/api/dashboard/products/untagged` — prodotti senza tag
- **GET** `/api/dashboard/products/{product_id}` — dettaglio completo (`ProductDetailOut`: images, prices, source_urls, tags, bundles)

## Merge

- **POST** `/api/products/merge` — unisce due prodotti.
  - Body:
    ```json
    {
      "main_product_id": 1,
      "merge_product_id": 2,
      "title": "…", "description": "…", "brand": "…", "origin_type": "…", "archived": false,
      "keep_image_ids": [1, 2],
      "keep_price_ids": [3],
      "keep_source_url_ids": [4],
      "tag_ids": [5, 6]
    }
    ```
  - I campi singoli sono opzionali (valori finali scelti nell'editor).
  - `keep_*` e `tag_ids` sono le **liste finali**: il BE sposta dal prodotto da mergiare ciò che va tenuto, elimina dal principale ciò che è stato tolto, imposta i tag come set esplicito, poi **elimina** il prodotto `merge_product_id`.
  - Errori: `400` se `main_product_id == merge_product_id`, `404` se uno dei prodotti non esiste.

## Source URL

- **GET** `/api/sourceurls/lookup?url=…` — anti-duplicato usato dal bot → `{ "found": bool, "product_id": int|null, "product_title": str|null }`
- **POST** `/api/sourceurls`, **PATCH** `/api/sourceurls/{source_id}`, **DELETE** `/api/sourceurls/{source_id}`
- **GET** `/api/products/{product_id}/source_urls`

## Immagini

- **POST** `/api/products/{product_id}/images/upload` — upload file (`multipart/form-data`, `201`)
- **POST** `/api/images` — crea il record immagine
- **PATCH** `/api/images/{image_id}`, **DELETE** `/api/images/{image_id}`
- **GET** `/api/products/{product_id}/images`
- I file sono serviti staticamente su `/media/...` (volume condiviso col bot).

## Prezzi

- **POST** `/api/prices`, **PATCH** `/api/prices/{price_id}`, **DELETE** `/api/prices/{price_id}`
- **GET** `/api/products/{product_id}/prices`

## Tag

- **GET** `/api/tags?kind=`, **POST** `/api/tags`, **PATCH** `/api/tags/{tag_id}`, **DELETE** `/api/tags/{tag_id}`
- **GET** `/api/tags/stats` → `{ tags: [{ …, count }], untagged_count }`
- **PUT** `/api/products/{product_id}/tags` — set esplicito (`{ "tag_ids": [..] }`)
- **POST** `/api/products/{product_id}/tags/{tag_id}` — aggiunge il tag **e i suoi ancestor** automaticamente
- **DELETE** `/api/products/{product_id}/tags/{tag_id}` — rimuove il tag

## Source websites

- **GET** `/api/sourcewebsites/stats` → `{ websites: [{ "name": "vinted", "count": 64 }, …] }`

## Bundle

- **GET** `/api/bundles`, **POST** `/api/bundles` (minimo 2 prodotti), **GET** `/api/products/{product_id}/bundles`

## Categorie

- **POST** `/api/categories`

---

## Errori comuni

- `400 Bad Request` — richiesta non valida (es. merge dello stesso prodotto)
- `404 Not Found` — risorsa non trovata
- `422 Unprocessable Entity` — dati non validi (validazione pydantic)

---

## Note

- Tutte le risposte sono in JSON.
- L'id di un prodotto è sempre generato dal DB.
- Per provare gli endpoint: Swagger UI (`/docs`), curl o Postman.

---

## Esempi curl

**Creazione prodotto:**

```sh
curl -X POST "http://localhost:8004/api/products" -H "Content-Type: application/json" -d '{
  "title": "Spilla originale sovietica",
  "description": "Descrizione...",
  "brand": "Vinted",
  "origin_type": "vinted"
}'
```

**Ricerca prodotti:**

```sh
curl "http://localhost:8004/api/products?q=spilla"
```

**Anti-duplicato (usato dal bot):**

```sh
curl "http://localhost:8004/api/sourceurls/lookup?url=https://www.vinted.it/items/123456-nome"
```

**Aggiornamento prodotto:**

```sh
curl -X PATCH "http://localhost:8004/api/products/1" -H "Content-Type: application/json" -d '{"archived": true}'
```
