# Interesting Items

Scraper di annunci usati: si mandano link via Telegram, il bot li scrapa e li salva in
Postgres; una UI web li elenca, li modifica e li unisce.

Tre componenti separati (codice, immagine Docker e container propri):

- `frontend/` — **FE** (React + Vite + nginx)
- `backend/` — **BE** (FastAPI + SQLModel; **unico proprietario del database**)
- `bot/` — **BOT** (bot Telegram + scraper)

FE e bot parlano al BE **solo via HTTP**.

## Avvio

```bash
docker compose up -d
```

- **UI** (FE, nginx): `http://localhost:3002`
- **API** (BE, FastAPI): `http://localhost:8004` — Swagger su `/docs`
- **bot**: nessuna porta esposta
- **db** (Postgres 15) e **redis**: rete interna

Crea `.env` (dettagli in `docs/OPERATIONS.md`):

```env
BOT_TOKEN=<tuo_token>
ALLOWED_TELEGRAM_USER_IDS=<id1,id2>
BASE_URL=http://<host>:3002
```

`BASE_URL` serve al bot per costruire i link interni nei messaggi: non usare `localhost`.

## Indice dei documenti

| Vuoi... | Apri |
|---|---|
| Trovare una funzione / una rotta / un simbolo | `docs/REFERENCE.md` |
| Capire come funziona | `docs/ARCHITECTURE.md` |
| Le regole prima di scrivere codice | `docs/CONVENTIONS.md` |
| Avvio, variabili, deploy, CI | `docs/OPERATIONS.md` |
| Cosa fa ogni vista del frontend | `docs/FEATURES.md` |

`AGENTS.md` (in root) e' la radice della mappa: e' il primo file da leggere.
