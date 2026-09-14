# Interesting Items - Mappa Funzionale (FEATURES)

> Mappa macro-funzionale e sotto-funzioni del frontend. Aggiornata a seguito dello split di `main.tsx` in hooks + componenti (PR refactor).
> Ultimo aggiornamento: 14 settembre 2026

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

- **Due elenchi** — prodotto principale (da mantenere) e prodotto da mergiare
- **Selezione** — clic per scegliere main e candidato
- **Campi da salvare** — titolo/descrizione/brand/origine/archiviato, con bottoni "Sinistra"/"Destra"
- **Importa risorse** — immagini, prezzi, link dal prodotto di destra (checkbox multipli)
- **Commit merge** — salva il merge, aggiorna lista+dettaglio
- **Annulla** — torna alla dashboard

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
- `MergeView.tsx` — vista Unisci prodotti
- `TagsView.tsx` — vista Tag
- `SourcesView.tsx` — vista Sorgenti
- `ProductCard.tsx` — card prodotto riusabile (lista + merge)
- `CreationModal.tsx` — modale nuovo prodotto
- `LightboxViewer.tsx` — viewer immagini fullscreen
- `Stats.tsx` — `StatCard` e `Kpi` riusabili

### Hook (`frontend/src/hooks/`)
- `useProducts` — lista, loading, error, ricerca, filtri tag/sito/escludi, stats
- `useProductDetail` — selezione, draft, editing, viewer, immagini, duplica
- `useMerge` — stato merge, candidato, draft, commit
- `useBundles` — stato bundle, crea bundle
- `useTags` — lista tag, crea tag, stats, gerarchia
- `useSourceWebsites` — stats siti

### Ormestratore
- `main.tsx` — `App()` compone gli hook e rende le viste in base alla tab attiva
