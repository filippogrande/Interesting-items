# Product Scraper API – Documentazione

Questa API REST consente la gestione completa dei prodotti, immagini, prezzi, source url e categorie per un sistema di scraping marketplace.

## Base URL

    http://localhost:8000/api/

---

## Endpoints Prodotto

### 1. Lista prodotti

- **GET** `/api/products`
- Parametri:
  - `q` (opzionale, string): ricerca per titolo
  - `limit` (opzionale, int): default 20
  - `offset` (opzionale, int): default 0
- Risposta: `200 OK`, lista di oggetti Product

### 2. Dettaglio prodotto

- **GET** `/api/products/{product_id}`
- Risposta: `200 OK`, oggetto Product
- Errori: `404 Not Found`

### 3. Crea prodotto

- **POST** `/api/products`
- Body: oggetto Product (JSON)
- Risposta: `201 Created`, oggetto Product creato

### 4. Aggiorna prodotto (parziale)

- **PATCH** `/api/products/{product_id}`
- Body: oggetto Product (solo campi da aggiornare)
- Risposta: `200 OK`, oggetto Product aggiornato
- Errori: `404 Not Found`

### 5. Elimina prodotto

- **DELETE** `/api/products/{product_id}`
- Risposta: `204 No Content`
- Errori: `404 Not Found`

---

## Modello Product (esempio JSON)

```json
{
  "id": 1,
  "title": "Spilla originale sovietica",
  "description": "Descrizione...",
  "brand": "Vinted",
  "origin_type": "marketplace",
  "product_metadata": "{...}",
  "category_id": 2,
  "archived": false,
  "scraped_at": "2026-02-11T13:49:46",
  "created_at": "2026-02-11T13:49:46",
  "updated_at": "2026-02-11T13:49:46"
}
```

---

## Errori comuni

- `404 Not Found`: risorsa non trovata
- `422 Unprocessable Entity`: dati non validi

---

## Note

- Tutte le risposte sono in formato JSON.
- Per immagini, prezzi, sourceurl, categorie: endpoint simili disponibili/da implementare.
- Per test: usare Postman, curl o Swagger UI (`/docs`).

---

## Esempi curl

**Creazione prodotto:**

```sh
curl -X POST "http://localhost:8000/api/products" -H "Content-Type: application/json" -d '{
  "title": "Spilla originale sovietica",
  "description": "Descrizione...",
  "brand": "Vinted"
}'
```

**Nota:** L'id viene sempre generato dal database, anche se specificato nel body verrà ignorato.

**Ricerca prodotti:**

```sh
curl "http://localhost:8000/api/products?q=spilla"
```

**Aggiornamento prodotto:**

```sh
curl -X PATCH "http://localhost:8000/api/products/1" -H "Content-Type: application/json" -d '{"archived": true}'
```

**Eliminazione prodotto:**

```sh
curl -X DELETE "http://localhost:8000/api/products/1"
```

---

Per dettagli su immagini, prezzi, sourceurl e categorie, vedere la documentazione estesa o richiedere l’implementazione degli endpoint specifici.
