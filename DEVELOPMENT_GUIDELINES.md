# Interesting Items - Linee Guida per lo Sviluppo

> Versione 1.2 - Paletti vincolanti. Ogni regola qui sotto è OBBLIGATORIA, non un suggerimento.
> Ultimo aggiornamento: 16 settembre 2026

## Indice
1. [Regola 0 - Componenti separati FE/BE/BOT (vincolante)](#regola-0)
2. [Regola 0-bis - Componenti e hook separati (frontend)](#regola-0bis)
3. [Dimensioni file e funzioni](#dimensioni)
4. [Single Source of Truth / Anti-duplicazione](#single-source)
5. [Convenzioni Frontend (React + Vite)](#convenzioni)
6. [Gestione Dati e API](#dati)
7. [No Fallback / No dati finti](#no-fallback)
8. [UI/UX Guidelines](#uiux)
9. [File di test / debug vietati nel tree](#test-vietati)
10. [Documentazione](#doc)
11. [Verifica Coerenza](#coerenza)

---

## 🔒 Regola 0 - Componenti separati FE / BE / BOT (DECISIONE VINCOLANTE) {#regola-0}

Il progetto ha **tre componenti separati**, ognuno con codice, immagine Docker e container propri:

- `frontend/` — **FE**: React + Vite + nginx.
- `backend/` — **BE**: FastAPI + modelli DB.
- `bot/` — **BOT**: bot Telegram + scraper.

Paletti:
- ✅ **Il BE è l'unico proprietario del database.** Nessun altro componente apre connessioni al DB.
- ✅ **FE e bot parlano al BE solo via HTTP.** Il bot usa un unico client (`bot/app/api_client.py`).
- ❌ MAI mettere bot o scraper dentro `backend/`, né far leggere il DB al bot.
- ❌ MAI avviare più processi diversi (API + bot) nello stesso container.
- Se serve un dato che il bot non riesce più a leggere dal DB, la risposta è **un nuovo endpoint sul BE**, non un accesso diretto.

Motivo: BE e bot erano nello stesso container e sulla stessa immagine; questo impediva deploy e test indipendenti e mescolava le responsabilità (parte del bot scriveva direttamente sul DB, parte usava l'API).

---

## 🔒 Regola 0-bis - Componenti e hook separati (frontend) {#regola-0bis}

**Niente file monolitici.** Il frontend è React + Vite + TypeScript: gli `import`/`export` ES6 sono **consentiti e obbligatori** (a differenza di Air-tycoon, qui NON vige il divieto di ES6).

- ✅ Ogni vista/feature è un componente in `frontend/src/components/`.
- ✅ La logica di stato condiviso vive in **custom hooks** in `frontend/src/hooks/` (`useProducts`, `useProductDetail`, `useMerge`, `useBundles`, `useTags`, `useSourceWebsites`).
- ✅ `main.tsx` è un **orchestratore snello**: compone gli hook e rende la vista attiva. NON contiene logica di stato.
- ✅ Gli hook che dipendono l'uno dall'altro ricevono le funzioni come parametri (no import circolari), es. `useMerge({ loadProducts, loadDetail })`.
- ❌ MAI rimettere tutta l'app in un unico `main.tsx` / `App` di migliaia di righe.

---

## 📏 Dimensioni file e funzioni {#dimensioni}

- **File**: nessun file frontend > 500 righe. Se superi, spezza per coesione semantica.
- **Funzioni**: nessuna funzione > 50 righe. Se superi, estrai sottologica in funzioni ausiliarie.
- Lo spezzamento deve essere per **coesione semantica**, NON a caso per numero di righe.

---

## 🔁 Single Source of Truth / Anti-duplicazione {#single-source}

- La card prodotto (`product-card`) deve esistere in **un solo** componente `<ProductCard>` e essere riusata sia nella lista (`ProductList`) sia nella pagina Unisci (`MergeView`).
- La logica di fetch dei prodotti (`loadProducts`) vive in un solo punto (l'hook `useProducts`).
- Il contatto col BE dal bot vive in un solo punto (`bot/app/api_client.py`).
- Niente costanti/URL/label replicati: se servono in più punti, vai in un modulo condiviso.

---

## ⚛️ Convenzioni Frontend (React + Vite) {#convenzioni}

- TypeScript strict: i tipi (`ProductSummary`, `ProductDetail`, `Tag`, ...) vivono in un `types.ts` condiviso.
- Props tipizzate (`props: any` solo dov'è inevitabile, mai come default).
- Stile: preferire `styles.css` con classi semantiche; gli `style={{...}}` inline sono ammessi per valori dinamici ma non per layout statico ripetuto.
- Niente `console.log` di debug in produzione.

---

## 🗄️ Gestione Dati e API {#dati}

- Il BE (FastAPI) espone paginazione via `limit`/`offset` su `/api/dashboard/products` e `/api/products`. **Usare la paginazione, non cap fissi.**
- Il DB è Postgres: `init_db()` usa `create_all` che **NON** aggiunge colonne a tabelle esistenti. Le nuove colonne vanno gestite dall'app, NON con `ALTER` manuale. **Non inventare campi/schema dal nulla**: confermare prima.
- L'anti-duplicato degli URL vive sul BE (`GET /api/sourceurls/lookup`): il bot lo interroga, non duplica la logica.
- Entrypoint del BE: `uvicorn app.server:app` (assemblaggio in `backend/app/server.py`).

---

## 🚫 No Fallback / No dati finti {#no-fallback}

- Un errore di fetch/API deve essere **mostrato** all'utente (es. `error-box`), non mascherato.
- ❌ MAI ritornare `[]` / `{}` / dati fittizi nei `catch`. Se i dati non ci sono, dillo.

---

## 🎨 UI/UX Guidelines {#uiux}

- Liste lunghe: usare **scroll interno** nel pannello (`maxHeight` + `overflowY: auto`), non allungare la pagina. Se serve confrontare elementi selezionati mentre si scrolla, pinnare il selezionato in alto (`position: sticky; top: 0`).
- Le card devono mostrare cover, titolo, origine, data, conteggi (img/prezzi/bundle) in modo coerente tra tutte le viste.
- I testi lunghi nelle liste vanno troncati (ellipsis).

---

## 🧪 File di test / debug vietati nel tree {#test-vietati}

- Nessun `test_*.tsx` / `debug_*.tsx` / `*_BACKUP.tsx` / `*_NEW.tsx` nel tree di produzione.
- Vale anche per il BE e il bot: gli script di prova vivono in `bot/tools/` o fuori dal repo.
- Una sola versione per componente: niente duplicati con suffissi.

---

## 📚 Documentazione {#doc}

- `PROJECT_ARCHITECTURE.md`: struttura reale del repo (FE, BE, BOT, DB, deploy).
- `DEVELOPMENT_GUIDELINES.md`: questo file (paletti vincolanti).
- `docs/FEATURES.md`: mappa funzionale macro/sotto-funzioni.
- Il backlog vive su **Vikunja** (progetto "Interesting items"), etichettato per componente (`FE` / `BE` / `BOT`).

---

## 🔍 Verifica Coerenza & Aggiornamento Doc {#coerenza}

- Prima di ogni PR: verificare di non introdurre file > 500 righe, duplicazione di componenti, o dipendenze DB fuori dal BE.
- Se una regola non è rispettata nel codice esistente, aprire task di cleanup su Vikunja anziché perpetuarla.
- Aggiornare questo file quando cambiano le convenzioni (bump versione + data in apertura).
