import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import TagsView from "./components/TagsView";
import "./styles.css";
import ProductCard from "./components/ProductCard";
import MergeView from "./components/MergeView";
import CreationModal from "./components/CreationModal";
import { SourcesView } from "./components/SourcesView";
import { LightboxViewer } from "./components/LightboxViewer";
import ProductDetailPanel from "./components/ProductDetailPanel";
import { useProducts } from "./hooks/useProducts";
import { useProductDetail } from "./hooks/useProductDetail";
import { useMerge } from "./hooks/useMerge";
import { useBundles } from "./hooks/useBundles";
import { useTags } from "./hooks/useTags";
import { useSourceWebsites } from "./hooks/useSourceWebsites";
import { formatDate, formatMoney, derivePlatformLabel, makeEmptyPrice, makeEmptySourceUrl, TAG_KIND_LABELS, TAG_KIND_ORDER } from "./utils/format";
import type { ProductDetail } from "./types";

function App() {
  const appVersion = (import.meta as any)?.env?.VITE_APP_VERSION ?? "v0.1.11";
  const [view, setView] = useState("dashboard");
  const [creating, setCreating] = useState(false);
  const [newProductDraft, setNewProductDraft] = useState<Partial<ProductDetail>>({
    title: "", description: "", brand: "", origin_type: "", archived: false,
    prices: [], source_urls: [], images: [], tags: [],
  });

  const { products, setProducts, loadingList, error, setError, query, setQuery, selectedTagId, setSelectedTagId, selectedSourceSite, setSelectedSourceSite, excludeTagIds, setExcludeTagIds, excludeTagsExpanded, setExcludeTagsExpanded, loadProducts, resetFilters, filteredProducts, stats } = useProducts();

  const { selected, setSelected, editing, setEditing, draft, setDraft, editingTagIds, setEditingTagIds, loadingDetail, viewerOpen, setViewerOpen, viewerIndex, setViewerIndex, draftPendingUploads, setDraftPendingUploads, draftDeletedImageIds, setDraftDeletedImageIds, imageUploadRef, loadDetail, refreshDetail, deleteProductImage, uploadProductImage, moveViewer, appendEditablePair, duplicateSelectedProduct } = useProductDetail();

  const { tags, setTags, tagsStats, setTagsStats, newTagName, setNewTagName, newTagKind, setNewTagKind, newTagParentId, setNewTagParentId, loadTagsStats, createTag, getAncestorIds, tagMap, tagsByKind } = useTags();

  const { sourceWebsitesStats, setSourceWebsitesStats, loadSourceWebsitesStats } = useSourceWebsites();

  const { mergeCandidateDetail, mergeCandidateLoading, mergePhase, setMergePhase, mergeDraft: mergeDraftState, setMergeDraft: setMergeDraftState, keepImageIds, setKeepImageIds, keepPriceIds, setKeepPriceIds, keepSourceUrlIds, setKeepSourceUrlIds, mergeTagIds, setMergeTagIds, loadMergeCandidate, openMergeEditor, goBackToChooser, commitMerge } = useMerge({ loadProducts: loadProducts as any, loadDetail });

  const { bundleCreatorOpen, setBundleCreatorOpen, bundleDraft, setBundleDraft, createBundle: createBundleFn, createBundleFromPrice: createBundleFromPriceFn } = useBundles({ loadDetail, loadProducts: loadProducts as any });

  const createBundle = () => createBundleFn(selected?.id as number);
  const createBundleFromPrice = (price: any, idx: number) => createBundleFromPriceFn(price, selected?.id as number);

  useEffect(() => {
    void loadTagsStats();
    void loadSourceWebsitesStats();
  }, []);

  // Ricarica i prodotti quando cambiano i filtri (tag / sito / escludi)
  useEffect(() => {
    void loadProducts(selectedTagId as any, selectedSourceSite, excludeTagIds, true);
  }, [selectedTagId, selectedSourceSite, excludeTagIds]);

  // Ricarica i prodotti ogni volta che si entra nella vista merge, così i prodotti
  // eliminati/mergiati in precedenza non restano visibili (dati freschi).
  useEffect(() => {
    if (view === "merge") {
      void loadProducts(selectedTagId as any, selectedSourceSite, excludeTagIds, true);
    }
  }, [view]);

  const toggleProductTag = async (productId: number, tagId: number, shouldAdd: boolean) => {
    try {
      if (shouldAdd) await fetch(`/api/products/${productId}/tags/${tagId}`, { method: "POST" });
      else await fetch(`/api/products/${productId}/tags/${tagId}`, { method: "DELETE" });
      await loadDetail(productId);
    } catch (err) { setError(err instanceof Error ? err.message : "Errore modifica tag"); }
  };

  const createNewProduct = async () => {
    setError(null);
    try {
      const payload: any = { title: newProductDraft.title || "Untitled", description: newProductDraft.description || "", brand: newProductDraft.brand || null, origin_type: newProductDraft.origin_type || null, archived: !!newProductDraft.archived };
      const resp = await fetch(`/api/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const created = await resp.json();
      await loadProducts(selectedTagId as any, selectedSourceSite, excludeTagIds);
      await loadDetail(created.id);
      setCreating(false);
      setNewProductDraft({ title: "", description: "", brand: "", origin_type: "", archived: false, prices: [] as any, source_urls: [] as any, images: [] as any, tags: [] as any });
    } catch (err) { setError(err instanceof Error ? err.message : "Errore creazione prodotto"); }
  };

  const toggleExcludeTag = (tagId: number) => setExcludeTagIds((c) => c.includes(tagId) ? c.filter((id) => id !== tagId) : [...c, tagId]);
  const clearExcludeTags = () => setExcludeTagIds([]);
  const onBack = () => setView("dashboard");
  const onRefresh = () => { void loadProducts(selectedTagId as any, selectedSourceSite, excludeTagIds); void loadTagsStats(); void loadSourceWebsitesStats(); };
  const onSelectAll = () => { setSelectedTagId(""); setSelectedSourceSite(""); setExcludeTagIds([]); };
  const onSelectSite = (siteName: string) => { setSelectedSourceSite(siteName); setSelectedTagId(""); };

  // Props del pannello dettaglio, riusati in tutte le viste lista+dettaglio
  const detailPanel = {
    selected, setSelected, loadingDetail, editing, setEditing, draft, setDraft,
    editingTagIds, setEditingTagIds, newTagName, setNewTagName, newTagKind, setNewTagKind,
    newTagParentId, setNewTagParentId, draftPendingUploads, setDraftPendingUploads,
    draftDeletedImageIds, setDraftDeletedImageIds, imageUploadRef, error, setError,
    products, tags, tagMap, tagsByKind, bundleDraft, setBundleDraft,
    bundleCreatorOpen, setBundleCreatorOpen, loadDetail, loadProducts: loadProducts as any,
    duplicateSelectedProduct, deleteProductImage, uploadProductImage, appendEditablePair,
    createBundle, createBundleFromPrice, toggleProductTag, getAncestorIds, createTag,
    setViewerIndex, setViewerOpen, formatDate, formatMoney, derivePlatformLabel,
    makeEmptyPrice, makeEmptySourceUrl, TAG_KIND_ORDER, TAG_KIND_LABELS,
    selectedTagId, selectedSourceSite, excludeTagIds,
  };

  // Vista lista+dettaglio riusabile (dashboard / tags / sources)
  const renderListDetail = (extraHeader?: React.ReactNode) => (
    <div className="layout">
      <section className="panel list-panel">
        <div className="panel-header">
          <h2>Prodotti ({stats.products})</h2>
        </div>
        {extraHeader}
        <div style={{ marginBottom: 12 }}>
          <input className="search search-full" placeholder="Cerca prodotti..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {selectedTagId !== "" && <div className="badge muted" style={{ marginBottom: 10 }}>Filtro tag attivo</div>}
        {selectedSourceSite && <div className="badge muted" style={{ marginBottom: 10 }}>Filtro sito: {selectedSourceSite}</div>}
        {error && <div className="error-box">{error}</div>}
        <div className="product-list">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} active={selected?.id === product.id} onClick={() => void loadDetail(product.id)} />
          ))}
          {!loadingList && filteredProducts.length === 0 && <div className="empty-state">Nessun prodotto trovato.</div>}
        </div>
      </section>
      <ProductDetailPanel {...detailPanel} />
    </div>
  );

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <h1>Interesting Items</h1>
        </div>
        <nav className="app-nav">
          <button className={`button ${view === "dashboard" ? "primary" : "secondary"}`} onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={`button ${view === "tags" ? "primary" : "secondary"}`} onClick={() => setView("tags")}>Tags</button>
          <button className={`button ${view === "sources" ? "primary" : "secondary"}`} onClick={() => setView("sources")}>Sources</button>
          <button className={`button ${view === "merge" ? "primary" : "secondary"}`} onClick={() => setView("merge")}>Merge</button>
          <button className="button primary" onClick={() => setCreating(true)}>Nuovo prodotto</button>
        </nav>
      </header>

      <main className="app-main">
        {view === "dashboard" && renderListDetail()}
        {view === "tags" && (<TagsView error={error} statsProducts={stats.products} tagsStats={tagsStats} selectedTagId={selectedTagId} setSelectedTagId={setSelectedTagId} selectedSourceSite={selectedSourceSite} setSelectedSourceSite={setSelectedSourceSite} query={query} setQuery={setQuery} TAG_KIND_ORDER={TAG_KIND_ORDER} TAG_KIND_LABELS={TAG_KIND_LABELS} tagsByKind={tagsByKind} excludeTagsExpanded={excludeTagsExpanded} setExcludeTagsExpanded={setExcludeTagsExpanded} excludeTagIds={excludeTagIds} toggleExcludeTag={toggleExcludeTag} clearExcludeTags={clearExcludeTags} tagMap={tagMap} filteredProducts={filteredProducts} selected={selected} loadDetail={loadDetail} loadingList={loadingList} formatDate={formatDate} formatMoney={formatMoney} onBack={onBack} onRefresh={onRefresh} detailPanel={detailPanel} />)}
        {view === "sources" && (<SourcesView sourceWebsitesStats={sourceWebsitesStats} totalProducts={stats.products} error={error} onBack={onBack} onRefresh={onRefresh} onSelectAll={onSelectAll} onSelectSite={onSelectSite} selectedSourceSite={selectedSourceSite} filteredProducts={filteredProducts} selected={selected} loadDetail={loadDetail} loadingList={loadingList} formatDate={formatDate} formatMoney={formatMoney} query={query} setQuery={setQuery} detailPanel={detailPanel} />)}
        {view === "merge" && (<MergeView filteredProducts={filteredProducts} selected={selected} mergeCandidateDetail={mergeCandidateDetail} query={query} setQuery={setQuery} error={error} setView={setView} loadDetail={loadDetail} loadMergeCandidate={loadMergeCandidate} mergePhase={mergePhase} openMergeEditor={openMergeEditor} goBackToChooser={goBackToChooser} commitMerge={commitMerge} mergeDraft={mergeDraftState} setMergeDraft={setMergeDraftState} keepImageIds={keepImageIds} setKeepImageIds={setKeepImageIds} keepPriceIds={keepPriceIds} setKeepPriceIds={setKeepPriceIds} keepSourceUrlIds={keepSourceUrlIds} setKeepSourceUrlIds={setKeepSourceUrlIds} mergeTagIds={mergeTagIds} setMergeTagIds={setMergeTagIds} />)}
      </main>

      <LightboxViewer selected={selected} viewerOpen={viewerOpen} setViewerOpen={setViewerOpen} viewerIndex={viewerIndex} moveViewer={moveViewer} />
      <CreationModal open={creating} draft={newProductDraft} onClose={() => setCreating(false)} onChange={(patch) => setNewProductDraft((d) => ({ ...(d || {}), ...patch }))} onCreate={createNewProduct} tags={tags} />
      <footer className="app-footer">Versione: {appVersion}</footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
