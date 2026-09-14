# Stato Refactoring - main.tsx

> Stato dello split del monolitico `main.tsx` (≈143KB / 3000 righe) in hook + componenti.
> Ultimo aggiornamento: 14 settembre 2026

## ✅ Completato

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

## 📄 Documentazione

- `docs/FEATURES.md` — mappa funzionale frontend
- `PROJECT_ARCHITECTURE.md` — struttura aggiornata con hook/componenti
- `DEVELOPMENT_GUIDELINES.md` v1.1 — aggiunto pattern custom hooks
