# Stato Refactoring

> Stato dei refactoring strutturali del progetto.
> Ultimo aggiornamento: 16 settembre 2026

## ✅ Separazione in 3 componenti (FE / BE / BOT)

Prima BE e bot erano **nello stesso container e sulla stessa immagine** (`backend/start.sh` avviava uvicorn + rq worker + bot), e parte del bot scriveva direttamente sul DB.

Ora:

- **FE** = `frontend/` (immagine `frontend-latest`)
- **BE** = `backend/` (immagine `backend-latest`) — **unico proprietario del DB**
- **BOT** = `bot/` (immagine `bot-latest`) — Telegram + scraper

Dettagli:
- Il bot parla al BE **solo via HTTP**: `bot/app/api_client.py` (nessun accesso al DB).
- Gli scraper sono in `bot/app/scrapers/` (`vinted.py`, `aliexpress.py`) e persistono via API.
- Nuovo endpoint BE `GET /api/sourceurls/lookup` per l'anti-duplicato del bot.
- BE entrypoint: `uvicorn app.server:app` (assemblaggio in `backend/app/server.py`).
- Rimossi dal BE: `app/bot.py`, `app/vinted.py`, `app/aliexpress.py`, `app/tasks.py` (ramo morto) e il `rq worker` (non accodava nulla).
- `docker-compose.yml`: 3 servizi (`app`, `bot`, `frontend`), immagini separate in CI.

Vedi `PROJECT_ARCHITECTURE.md` e `DEVELOPMENT_GUIDELINES.md` (Regola 0).

## ✅ Stato Refactoring - main.tsx

> Stato dello split del monolitico `main.tsx` (≈143KB / 3000 righe) in hook + componenti.

### Completato

- `main.tsx` ridotto a **orchestratore snello** (~400 righe): compone gli hook e rende la vista attiva.
- **Hook** (`frontend/src/hooks/`): `useProducts`, `useProductDetail`, `useMerge`, `useBundles`, `useTags`, `useSourceWebsites`.
- **Componenti** (`frontend/src/components/`): `ProductDetailPanel`, `MergeView`, `TagsView`, `SourcesView`, `ProductCard`, `CreationModal`, `LightboxViewer`, `Stats`.
- `ProductCard.tsx` riusabile ✓
- `MergeView.tsx` ✓
- `TagsView.tsx` ✓
- `SourcesView.tsx` ✓
- `ProductDetailPanel.tsx` ✓
- `types.ts` ✓
- `utils/format.ts` ✓ (export ripristinati)

### Documentazione

- `docs/FEATURES.md` — mappa funzionale frontend
- `PROJECT_ARCHITECTURE.md` — struttura aggiornata (FE/BE/BOT)
- `DEVELOPMENT_GUIDELINES.md` v1.2 — componenti separati + pattern custom hooks
