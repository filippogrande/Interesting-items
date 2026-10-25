# CONVENTIONS — paletti del repo

<!-- Tipo: HOW-TO. Le regole da rispettare quando scrivi codice qui. -->
<!-- Versione 2.0 - Paletti vincolanti. Ogni regola e' OBBLIGATORIA, non un suggerimento. -->

## Regola 0 — Componenti separati FE / BE / BOT (vincolante)

Il progetto ha **tre componenti separati**, ognuno con codice, immagine Docker e container
propri:

- `frontend/` — **FE**: React + Vite + nginx.
- `backend/` — **BE**: FastAPI + modelli DB.
- `bot/` — **BOT**: bot Telegram + scraper.

Paletti:

- Il BE e' **l'unico proprietario del database**. Nessun altro componente apre connessioni
  al DB.
- FE e bot parlano al BE **solo via HTTP**. Il bot usa un unico client
  (`bot/app/api_client.py`).
- MAI mettere bot o scraper dentro `backend/`, ne' far leggere il DB al bot.
- MAI avviare piu' processi diversi (API + bot) nello stesso container.
- Se serve un dato che il bot non riesce piu' a leggere dal DB, la risposta e' **un nuovo
  endpoint sul BE**, non un accesso diretto.

## Regola 0-bis — Componenti e hook separati (frontend)

**Niente file monolitici.** Il frontend e' React + Vite + TypeScript: gli
`import`/`export` ES6 sono **consentiti e obbligatori**.

- Ogni vista/feature e' un componente in `frontend/src/components/`.
- La logica di stato condivisa vive in **custom hooks** in `frontend/src/hooks/`
  (`useProducts`, `useProductDetail`, `useMerge`, `useBundles`, `useTags`,
  `useSourceWebsites`).
- `main.tsx` e' un **orchestratore snello**: compone gli hook e rende la vista attiva.
  NON contiene logica di stato.
- Gli hook che dipendono l'uno dall'altro ricevono le funzioni come parametri (no import
  circolari), es. `useMerge({ loadProducts, loadDetail })`.
- MAI rimettere tutta l'app in un unico `main.tsx` / `App` di migliaia di righe.

## Dimensioni file e funzioni

- **File**: nessun file > 500 righe. Se superi, spezza per coesione semantica.
- **Funzioni**: nessuna funzione > 50 righe. Se superi, estrai sottologica in funzioni
  ausiliarie.
- Lo spezzamento deve essere per **coesione semantica**, NON a caso per numero di righe.

## Single Source of Truth / Anti-duplicazione

- La card prodotto deve esistere in **un solo** componente `<ProductCard>` ed essere riusata
  sia nella lista sia nella pagina Unisci (`MergeView`).
- La logica di fetch dei prodotti (`loadProducts`) vive in un solo punto (l'hook `useProducts`).
- Il contatto col BE dal bot vive in un solo punto (`bot/app/api_client.py`).
- Niente costanti/URL/label replicati: se servono in piu' punti, vanno in un modulo condiviso.

## Convenzioni Frontend (React + Vite)

- TypeScript strict: i tipi (`ProductSummary`, `ProductDetail`, `Tag`, ...) vivono in un
  `types.ts` condiviso.
- Props tipizzate (`props: any` solo dov'e' inevitabile, mai come default).
- Stile: preferire `styles.css` con classi semantiche; gli `style={{...}}` inline sono ammessi
  per valori dinamici ma non per layout statico ripetuto.
- Niente `console.log` di debug in produzione.

## Gestione Dati e API

- Il BE espone paginazione via `limit`/`offset` su `/api/dashboard/products` e
  `/api/products`. **Usare la paginazione, non cap fissi.**
- Il DB e' Postgres: `init_db()` usa `create_all`, che **NON** aggiunge colonne a tabelle
  esistenti. Le nuove colonne vanno gestite dall'app, NON con `ALTER` manuale.
  **Non inventare campi/schema dal nulla**: confermare prima.
- L'anti-duplicato degli URL vive sul BE (`GET /api/sourceurls/lookup`): il bot lo
  interroga, non duplica la logica.
- Entrypoint del BE: `uvicorn app.server:app` (assemblaggio in `backend/app/server.py`).

## No Fallback / No dati finti

- Un errore di fetch/API deve essere **mostrato** all'utente (es. `error-box`), non
  mascherato.
- MAI ritornare `[]` / `{}` / dati fittizi nei `catch`. Se i dati non ci sono, dillo.

## UI/UX Guidelines

- Liste lunghe: **scroll interno** nel pannello (`maxHeight` + `overflowY: auto`), non
  allungare la pagina. Se serve confrontare elementi selezionati mentre si scrolla, pinnare
  il selezionato in alto (`position: sticky; top: 0`).
- Le card devono mostrare cover, titolo, origine, data, conteggi (img/prezzi/bundle) in modo
  coerente tra tutte le viste.
- I testi lunghi nelle liste vanno troncati (ellipsis).

## File di test / debug vietati nel tree

- Nessun `test_*.tsx` / `debug_*.tsx` / `*_BACKUP.tsx` / `*_NEW.tsx` nel tree di produzione.
- Vale anche per il BE e il bot: gli script di prova vivono in `bot/tools/` o fuori dal repo.
- Una sola versione per componente: niente duplicati con suffissi.

## Documentazione

- I doc stanno in `docs/` e si leggono a partire da `AGENTS.md` (in root).
- Il backlog vive su **Vikunja** (progetto "Interesting items"), etichettato per componente
  (`FE` / `BE` / `BOT`).
- Un doc che mente e' peggio di nessuna doc: si corregge o si cancella **nella stessa PR**.

## Verifica coerenza e aggiornamento doc

- Prima di ogni PR: verificare di non introdurre file > 500 righe, duplicazione di
  componenti, o dipendenze DB fuori dal BE.
- Se una regola non e' rispettata nel codice esistente, aprire task di cleanup su Vikunja
  anziche' perpetuarla. Le infrazioni note sono elencate in `docs/REFERENCE.md`
  (sezione "Limiti noti").
- Aggiornare i doc quando cambiano le convenzioni (bump versione + data in apertura).

## Dipendenze e Dependabot

- Ogni manifest di dipendenze — `frontend/package.json`, `backend/requirements.txt`,
  `bot/requirements.txt`, i `Dockerfile`, `docker-compose.yml` +
  `infra/docker-compose.dev.yml`, i file in `.github/workflows/` — deve avere la sua voce
  in `.github/dependabot.yml`, con la directory corretta.
- **Regola operativa**: quando aggiungi o modifichi un manifest, aggiorni
  `.github/dependabot.yml` **nella stessa PR**. Mai "lo faccio dopo".
- Manifest in sottocartelle: usa `directories: ["...", "..."]` per lo stesso ecosistema.
- **Le dipendenze Python vanno vincolate a una versione.** Un `requirements.txt` con i soli
  nomi (`fastapi`, `requests`) e' **invisibile** a Dependabot: senza versioni non arriva
  nessun aggiornamento e nessun alert di sicurezza. Usare `==` o un lock generato
  (pip-tools / uv).
- Il pin va preso dalla versione realmente in uso nell'immagine in produzione, non scelta a
  caso.
- MAI manifest "finti" per far contento Dependabot, e mai config per repo archiviati.
- Il file e' operativo **solo se e' sul branch di default**: aggiungerlo in una PR non
  basta, va mergiata.
