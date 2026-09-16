# Interesting Items - Mappa Funzionale (FEATURES)

> Mappa macro-funzionale e sotto-funzioni del frontend. Aggiornata a seguito dello split di `main.tsx` in hooks + componenti e del redesign della vista Merge.
> Ultimo aggiornamento: 16 settembre 2026

## 1. Dashboard (vista principale)

- **Lista prodotti** — elenco completo con card (cover, titolo, origine, data, conteggi img/prezzi/bundle, prezzo più recente)
- **Ricerca** — filtro per testo (titolo/descrizione/origine)
- **Reset filtri** — azzera ricerca e filtri attivi
- **Stats grid (6 card)** — Prodotti, Immagini, Prezzi, Sorgenti, Unisci i prodotti, Tag
- **Auto-selezione** — al caricamento apre automaticamente il primo prodotto nel pannello dettaglio
- **Pannello Dettaglio** — affiancato alla lista (vedi §2)

## 2. Pannello Dettaglio Prodotto (`ProductDetailPanel`)

- **Visualizzazione** — titolo, descrizione, origine, prezzo, date (creato/scansionato), tag, galleria immagini, prezzi+link, bundle
- **Duplica** — crea una copia del prodotto con tutti i dati
- **Modifica** — entra in edit mode
- **Elimina** — cancella il prodotto (con conferma)
- **Edit mode:**
  - Cambia titolo/descrizione/brand/archiviato
  - **Tag** — aggiungi/rimuovi tag, crea nuovo tag (con parent), gestione gerarchia (gli ancestor si aggiungono automaticamente)
  - **Galleria** — elimina immagini, upload nuove (anteprima "in attesa"), marca per eliminazione
  - **Prezzi+link** — modifica prezzo/valuta/piattaforma/link, aggiungi riga, elimina riga, "Trasforma in bundle"
  - **Salva** — PATCH prodotto, PUT tag, PATCH/POST prezzi, PATCH/POST sourceurl, DELETE immagini marcate, upload pendenti, refresh lista+dettaglio, deseleziona se fuori filtro
  - **Annulla** — esce senza salvare
- **Bundle** — elenco bundle collegati, crea nuovo bundle (titolo/prezzo/valuta/link/note/selezione prodotti), "Trasforma in bundle" da un prezzo

## 3. Viewer Immagini (`LightboxViewer`)

- Lightbox fullscreen
- Navigazione ‹ / ›
- Chiusura con Escape o click fuori
- Blocco scroll pagina mentre è aperto

## 4. Vista Tags (`TagsView`)

- **Stats tag** — conteggi per tag + conteggio non-taggati
- **Filtro per tag** — seleziona un tag per filtrare la lista
- **Filtro per sito** — filtra per fonte (Vinted/AliExpress/…)
- **Escludi tag** — pannello espandibile con lista gerarchica, chip selezionati, azzera
- **Navigazione** — back / refresh

## 5. Vista Sources (`SourcesView`)

- **Stats source websites** — elenco siti con conteggi
- **Seleziona tutti / Seleziona sito** — filtra la dashboard per origine

## 6. Vista Merge (`MergeView`)

La vista ha **due fasi** (stato `mergePhase` in `useMerge`: `chooser` | `editor`).

### 6.1 Selezione (`chooser`)
- **Due colonne** — `Main` (prodotto da mantenere) e `Da mergiare` (prodotto che verrà eliminato)
- **Selezione indipendente** — ogni colonna esclude il prodotto scelto nell'altra: non è possibile selezionare lo stesso oggetto su entrambi i lati
- **Scroll interno + card pinnata in alto** — il prodotto selezionato resta visibile mentre si scorre la lista (`position: sticky` + `overflowY: auto`)
- **Prosegui** — abilitato solo quando entrambi i prodotti sono scelti; apre la fase di confronto

### 6.2 Confronto (`editor`)
- **Due metà fisse** — a sinistra i valori del `Main`, a destra quelli `Da mergiare`
- **Campi singoli** — Titolo, Descrizione, Brand, Origine, Archiviato: clic sul valore per sceglierlo (evidenziato), il valore scelto è poi modificabile nel pannello "Valori finali"
- **Campi multipli** — Immagini, Prezzi+link, Tag: **unione automatica dei due prodotti**, con X per rimuovere (↺ per ripristinare)
- **Prezzi e link sono coppie legate** — una X rimuove entrambi (sono accoppiati per indice nel modello)
- **← Indietro** (in alto a sinistra) — torna alla selezione **conservando** selezioni e modifiche
- **Salva merge** (in alto a destra) — invia al BE le liste finali (`keep_image_ids`, `keep_price_ids`, `keep_source_url_ids`, `tag_ids`) + i valori dei campi singoli
- **Refresh dopo il salvataggio** — a merge concluso l'App ricarica il **dettaglio del prodotto principale** (che ora contiene anche immagini/prezzi/link/tag arrivati dal prodotto mergiato) e **la lista prodotti**; senza questo, un merge successivo partirebbe da dati stantii (es. si vedrebbero solo i prezzi originali)

## 7. Creazione Prodotto (`CreationModal`)

- Form: titolo, descrizione, brand, origine
- **Crea** — POST nuovo prodotto, refresh lista, apre il dettaglio

## 8. Navigazione / Header

- Tabs: Dashboard / Tags / Sources / Merge
- Pulsante "Nuovo prodotto"
- Footer con versione

---

## Struttura del codice (dove vive ogni funzionalità)

### Componenti (`frontend/src/components/`)
- `ProductDetailPanel.tsx` — pannello dettaglio + edit mode (sezione più complessa)
- `MergeView.tsx` — vista Unisci prodotti (fasi `chooser` e `editor`)
- `TagsView.tsx` — vista Tag
- `SourcesView.tsx` — vista Sorgenti
- `ProductCard.tsx` — card prodotto riusabile (lista + merge)
- `CreationModal.tsx` — modale nuovo prodotto
- `LightboxViewer.tsx` — viewer immagini fullscreen
- `Stats.tsx` — `StatCard` e `Kpi` riusabili

### Hook (`frontend/src/hooks/`)
- `useProducts` — lista, loading, error, ricerca, filtri tag/sito/escludi, stats
- `useProductDetail` — selezione, draft, editing, viewer, immagini, duplica
- `useMerge` — fase merge (`chooser`/`editor`), candidato, draft campi singoli, liste keep (immagini/prezzi/link/tag), commit
- `useBundles` — stato bundle, crea bundle
- `useTags` — lista tag, crea tag, stats, gerarchia
- `useSourceWebsites` — stats siti

### Orchestratore
- `main.tsx` — `App()` compone gli hook e rende le viste in base alla tab attiva; per il merge espone `commitMergeAndRefresh` (commit + ricarica dettaglio e lista)

---

## Altri componenti del progetto

Questa mappa copre il **FE**. Gli altri due componenti sono:
- **BE** (`backend/`) — API FastAPI + modelli DB
- **BOT** (`bot/`) — bot Telegram + scraper (Vinted, AliExpress)

Vedi `PROJECT_ARCHITECTURE.md` per la struttura completa.
