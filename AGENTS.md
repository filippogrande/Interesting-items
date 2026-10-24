# AGENTS.md — Interesting Items

<!-- Radice della mappa. Leggi questo file per primo, ogni volta. <=150 righe. -->
<!-- Tutto cio' che non serve a OGNI task vive a un link di distanza. -->

## Cosa e'

Scraper di annunci usati: si mandano link via Telegram, il bot li scrapa e li salva in
Postgres; una UI web (React) li elenca, li modifica e li unisce.

- Stack: Python (FastAPI + SQLModel) per il BE, Python (aiogram + Playwright) per il
  BOT, React + Vite + TypeScript per il FE, Redis per le code, Postgres per i dati.
- Deploy: Docker Compose — 3 immagini (`frontend`, `backend`, `bot`) + `db` + `redis`.
- Backlog: Vikunja, progetto "Interesting items", etichette `FE` / `BE` / `BOT`.

## Comandi

| Azione | Comando |
|---|---|
| Avvio (consigliato) | `docker compose up -d` |
| Log del bot | `docker compose logs -f bot` |
| Log del BE | `docker compose logs -f app` |
| Shell nel BE | `docker compose exec app bash` |
| Query al DB | `docker compose exec db psql -U postgres -d products` |
| Dev BE / FE / BOT | `make dev-backend` / `make dev-frontend` / `make start-bot` |
| Build FE | `cd frontend && npm ci && npm run build` |

## Indice — richiesta -> dove

| Vuoi... | Apri |
|---|---|
| Trovare una funzione, una rotta, un simbolo | `docs/REFERENCE.md` |
| Capire come funziona / perche' una scelta | `docs/ARCHITECTURE.md` |
| Scrivere codice senza violare le regole | `docs/CONVENTIONS.md` |
| Avviare, deployare, variabili d'ambiente | `docs/OPERATIONS.md` |
| Cosa fa ogni vista del frontend | `docs/FEATURES.md` |
| Cambiare un endpoint o un modello del BE | `docs/REFERENCE.md` (sezione API) |
| Cambiare il flusso di scraping o le code | `docs/ARCHITECTURE.md` (sezione Flusso) |
| Cambiare deploy / CI / compose | `docs/OPERATIONS.md` |
| Cambiare una regola o un paletto | `docs/CONVENTIONS.md` |

## Documenti

| Doc | Tipo | Stato | A cosa serve |
|---|---|---|---|
| `docs/REFERENCE.md` | reference | ACTIVE 24/10/26 | la mappa: richiesta -> file -> simbolo |
| `docs/ARCHITECTURE.md` | explanation | ACTIVE 24/10/26 | componenti, flusso, anti-duplicato, DB, deploy |
| `docs/CONVENTIONS.md` | how-to | ACTIVE 24/10/26 | paletti vincolanti, limiti, regole del repo |
| `docs/OPERATIONS.md` | how-to | ACTIVE 24/10/26 | avvio, variabili, comandi, deploy, CI |
| `docs/FEATURES.md` | reference | ACTIVE 24/10/26 | mappa funzionale del frontend |

## Regole

- Branch + PR, mai push su `main`.
- I doc (incluse le righe di questa mappa) si aggiornano NELLA STESSA PR che li invalida.
- Limiti: 500 righe/file, 50 righe/funzione, no fallback silenziosi, no file di test nel tree.
- Onesta' della mappa: una riga con un percorso sbagliato si corregge subito, non si annota.
