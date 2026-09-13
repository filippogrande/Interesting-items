# Interesting Items - Linee Guida per lo Sviluppo

> Versione 1.0 - Paletti vincolanti. Ogni regola qui sotto è OBBLIGATORIA, non un suggerimento.
> Ultimo aggiornamento: 19 agosto 2026

## Indice
1. [Regola 0 - Componenti separati (vincolante)](#regola-0)
2. [Dimensioni file e funzioni](#dimensioni)
3. [Single Source of Truth / Anti-duplicazione](#single-source)
4. [Convenzioni Frontend (React + Vite)](#convenzioni)
5. [Gestione Dati e API](#dati)
6. [No Fallback / No dati finti](#no-fallback)
7. [UI/UX Guidelines](#uiux)
8. [File di test / debug vietati nel tree](#test-vietati)
9. [Documentazione](#doc)
10. [Verifica Coerenza](#coerenza)

---

## 🔒 Regola 0 - Componenti separati (DECISIONE VINCOLANTE) {#regola-0}

**Niente file monolitici.** Il frontend è React + Vite + TypeScript: gli `import`/`export` ES6 sono **consentiti e obbligatori** (a differenza di Air-tycoon, qui NON vige il divieto di ES6).

- ✅ Ogni vista/feature è un componente in `frontend/src/components/`.
- ✅ Lo stato condiviso (prodotti, selezione, tag) vive in `App.tsx` e viene passato per props ai componenti.
- ❌ MAI mettere tutta l'app in un unico `main.tsx` / `App` di migliaia di righe.

Motivo: un file di 143KB (≈3000 righe) non è leggibile né dall'agente né in review, e le modifiche cieche su di esso producono regressioni. Lo spezzamento di `main.tsx` è il **prerequisito** di ogni refactoring futuro.

---

## 📏 Dimensioni file e funzioni {#dimensioni}

- **File**: nessun file frontend > 500 righe. Se superi, spezza per coesione semantica (es. `Dashboard.tsx`, `MergeView.tsx`, `TagsView.tsx`, `SourcesView.tsx`).
- **Funzioni**: nessuna funzione > 50 righe. Se superi, estrai sottologica in funzioni ausiliarie.
- Lo spezzamento deve essere per **coesione semantica**, NON a caso per numero di righe (2 file da 500 spezzati a caso = peggio di 1 da 1000).

---

## 🔁 Single Source of Truth / Anti-duplicazione {#single-source}

- La card prodotto (`product-card`) deve esistere in **un solo** componente `<ProductCard>` e essere riusata sia nella lista (`ProductList`) sia nella pagina Unisci (`MergeView`). Non ridisegnare a mano la stessa card in due posti.
- La logica di fetch dei prodotti (`loadProducts`) vive in un solo punto; i componenti la invocano, non la duplicano.
- Niente costanti/URL/label replicati: se servono in più punti, vai in un modulo condiviso.

---

## ⚛️ Convenzioni Frontend (React + Vite) {#convenzioni}

- TypeScript strict: i tipi (`ProductSummary`, `ProductDetail`, `Tag`, ...) vivono in cima al modulo che li usa o in un `types.ts` condiviso.
- Props tipizzate (`props: any` solo dov'è inevitabile, mai come default).
- Stile: preferire `styles.css` con classi semantiche; gli `style={{...}}` inline sono ammessi per valori dinamici (es. altezze calcolate) ma non per layout statico ripetuto.
- Niente `console.log` di debug in produzione.

---

## 🗄️ Gestione Dati e API {#dati}

- Il backend (FastAPI in `backend/app/api.py`) espone già paginazione via `limit`/`offset` su `/api/dashboard/products` e `/api/products`. **Usare la paginazione, non cap fissi** (es. non hardcodare `limit: 100`): se serve mostrare tutti i prodotti, implementare scroll infinito o bottoni "carica altri" lato frontend.
- Il DB è Postgres: `init_db()` usa `create_all` che **NON** aggiunge colonne a tabelle esistenti. Le nuove colonne vanno gestite dall'app (migration/versione), NON con `ALTER` manuale né aggiunte a caso al modello. Se il codice chiede una colonna che il DB non ha → 500 su SELECT. Regola operativa: **non inventare campi/schema dal nulla**; confermare prima di aggiungere colonne.
- Il bot Telegram normalizza gli URL e controlla `SourceUrl` nel DB (anti-duplicato nativo): non serve logica di upsert custom lato bot.

---

## 🚫 No Fallback / No dati finti {#no-fallback}

- Un errore di fetch/API deve essere **mostrato** all'utente (es. `error-box`), non mascherato da un valore di comodo.
- ❌ MAI ritornare `[]` / `{}` / dati fittizi nei `catch` per "far continuare" l'UI. Se i dati non ci sono, dillo.
- I `catch` possono loggare per debug, ma non devono nascondere il fallimento all'utente né allo sviluppatore.

---

## 🎨 UI/UX Guidelines {#uiux}

- Liste lunghe: usare **scroll interno** nel pannello (`maxHeight` + `overflowY: auto`), non allungare la pagina. Se serve confrontare elementi selezionati mentre si scrolla, pinnare il selezionato in alto (es. `position: sticky; top: 0`).
- Le card devono mostrare cover, titolo, origine, data, conteggi (img/prezzi/bundle) in modo coerente tra tutte le viste.
- I testi lunghi nelle liste vanno troncati (ellipsis) per non rompere il layout.

---

## 🧪 File di test / debug vietati nel tree {#test-vietati}

- Nessun `test_*.tsx` / `debug_*.tsx` / `*_BACKUP.tsx` / `*_NEW.tsx` nel tree di produzione.
- I file di prova, se servono, vivono fuori dal repo o in una cartella `scratch/` non linkata dal build.
- Una sola versione per componente: niente duplicati con suffissi.

---

## 📚 Documentazione {#doc}

- `PROJECT_ARCHITECTURE.md`: struttura reale del repo (backend, frontend, DB, deploy).
- `DEVELOPMENT_GUIDELINES.md`: questo file (paletti vincolanti).
- `PAGES_GUIDE.md`: non presente (le viste sono poche e coperte da architettura + guidelines); crearlo solo se le viste diventano complesse.
- Il backlog di feature/bug vive su **TickTick** (progetto "Interesting items"), non nei `.md`.

---

## 🔍 Verifica Coerenza & Aggiornamento Doc {#coerenza}

- Prima di ogni PR che tocca il frontend, verificare di non introdurre file > 500 righe o duplicazione di componenti.
- Se una regola qui sopra non è rispettata nel codice esistente, aprire task di cleanup su TickTick (es. "Refactoring: spezzare main.tsx") anziché perpetuarla.
- Aggiornare questo file quando cambiano le convenzioni (bump versione + data in apertura).
