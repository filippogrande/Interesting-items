import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import TagsView from "./components/TagsView";
import "./styles.css";
import ProductCard from "./components/ProductCard";
import MergeView from "./components/MergeView";
import CreationModal from "./components/CreationModal";
import { StatCard, Kpi } from "./components/Stats";
import { SourcesView } from "./components/SourcesView";
import { LightboxViewer } from "./components/LightboxViewer";
import { useProducts } from "./hooks/useProducts";
import { useProductDetail } from "./hooks/useProductDetail";
import { useMerge } from "./hooks/useMerge";
import { useBundles } from "./hooks/useBundles";
import { useTags } from "./hooks/useTags";
import { useSourceWebsites } from "./hooks/useSourceWebsites";
import { formatDate, formatMoney, TAG_KIND_LABELS, TAG_KIND_ORDER } from "./utils/format";
import type { ProductDetail } from "./types";

function App() {
  const appVersion = (import.meta as any)?.env?.VITE_APP_VERSION ?? "v0.1.11";
  const [view, setView] = useState<"dashboard" | "tags" | "sources" | "merge">(
    "dashboard",
  );
  const [creating, setCreating] = useState(false);
  const [newProductDraft, setNewProductDraft] = useState<
    Partial<ProductDetail>
  >({
    title: "",
    description: "",
    brand: "",
    origin_type: "",
    archived: false,
    prices: [],
    source_urls: [],
    images: [],
    tags: [],
  });
  const [bundleCreatorOpen, setBundleCreatorOpen] = useState(false);
  const [bundleDraft, setBundleDraft] = useState({
    title: "",
    amount: "",
    currency: "EUR",
    sourceUrl: "",
    notes: "",
    productIds: [] as number[],
  });

  const {
    products,
    setProducts,
    loadingList,
    error,
    setError,
    query,
    setQuery,
    selectedTagId,
    setSelectedTagId,
    selectedSourceSite,
    setSelectedSourceSite,
    excludeTagIds,
    setExcludeTagIds,
    excludeTagsExpanded,
    setExcludeTagsExpanded,
    loadProducts,
    resetFilters,
    filteredProducts,
    stats,
  } = useProducts();

  const {
    selected,
    setSelected,
    editing,
    setEditing,
    draft,
    setDraft,
    editingTagIds,
    setEditingTagIds,
    loadingDetail,
    viewerOpen,
    setViewerOpen,
    viewerIndex,
    setViewerIndex,
    draftPendingUploads,
    setDraftPendingUploads,
    draftDeletedImageIds,
    setDraftDeletedImageIds,
    imageUploadRef,
    loadDetail,
    refreshDetail,
    deleteProductImage,
    uploadProductImage,
    moveViewer,
    appendEditablePair,
    duplicateSelectedProduct,
    toggleProductTag,
  } = useProductDetail();

  const {
    tags,
    setTags,
    tagsStats,
    setTagsStats,
    newTagName,
    setNewTagName,
    newTagKind,
    setNewTagKind,
    newTagParentId,
    setNewTagParentId,
    loadTagsStats,
    createTag,
    getAncestorIds,
    tagMap,
    tagsByKind,
  } = useTags();

  const {
    sourceWebsitesStats,
    setSourceWebsitesStats,
    loadSourceWebsitesStats,
  } = useSourceWebsites();

  const {
    mergeCandidateDetail,
    mergeCandidateLoading,
    mergePhase,
    setMergePhase,
    mergeDraft: mergeDraftState,
    setMergeDraft: setMergeDraftState,
    mergeSelectedImageIds,
    setMergeSelectedImageIds,
    mergeSelectedPriceIds,
    setMergeSelectedPriceIds,
    mergeSelectedSourceUrlIds,
    setMergeSelectedSourceUrlIds,
    buildMergeDraft,
    loadMergeCandidate,
    openMergeEditor,
    commitMerge,
  } = useMerge({
    loadProducts: loadProducts as any,
    loadDetail,
  });

  const {
    bundleCreatorOpen: bundleOpen,
    setBundleCreatorOpen: setBundleOpen,
    bundleDraft: bundleState,
    setBundleDraft: setBundleState,
    createBundle,
    createBundleFromPrice,
  } = useBundles({
    loadDetail,
    loadProducts: loadProducts as any,
  });

  useEffect(() => {
    void loadProducts(selectedTagId as number | "" | "untagged", selectedSourceSite, excludeTagIds);
    void loadTagsStats();
    void loadSourceWebsitesStats();
  }, []);

  const toggleExcludeTag = (tagId: number) => {
    setExcludeTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  };

  const clearExcludeTags = () => {
    setExcludeTagIds([]);
  };

  const createNewProduct = async () => {
    setError(null);
    try {
      const payload: any = {
        title: newProductDraft.title || "Untitled",
        description: newProductDraft.description || "",
        brand: newProductDraft.brand || null,
        origin_type: newProductDraft.origin_type || null,
        archived: !!newProductDraft.archived,
      };
      const resp = await fetch(`/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const created = await resp.json();
      await loadProducts(
        selectedTagId as number | "" | "untagged",
        selectedSourceSite,
        excludeTagIds,
      );
      await loadDetail(created.id);
      setCreating(false);
      setNewProductDraft({
        title: "",
        description: "",
        brand: "",
        origin_type: "",
        archived: false,
        prices: [] as any,
        source_urls: [] as any,
        images: [] as any,
        tags: [] as any,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore creazione prodotto",
      );
    }
  };

  const onSelectAll = () => {
    setSelectedTagId("");
    setSelectedSourceSite("");
  };

  const onSelectSite = (siteName: string) => {
    setSelectedSourceSite(siteName);
  };

  const onBack = () => {
    setView("dashboard");
  };

  const onRefresh = () => {
    void loadProducts(selectedTagId as number | "" | "untagged", selectedSourceSite, excludeTagIds);
    void loadTagsStats();
    void loadSourceWebsitesStats();
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Interesting Items</h1>
        <nav className="app-nav">
          <button
            className={`button ${view === "dashboard" ? "primary" : "secondary"}`}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`button ${view === "tags" ? "primary" : "secondary"}`}
            onClick={() => setView("tags")}
          >
            Tags
          </button>
          <button
            className={`button ${view === "sources" ? "primary" : "secondary"}`}
            onClick={() => setView("sources")}
          >
            Sources
          </button>
          <button
            className={`button ${view === "merge" ? "primary" : "secondary"}`}
            onClick={() => setView("merge")}
          >
            Merge
          </button>
          <button
            className="button primary"
            onClick={() => setCreating(true)}
          >
            Nuovo prodotto
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === "dashboard" && (
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Prodotti ({stats.products})</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="search"
                  placeholder="Cerca prodotti..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="button secondary" onClick={resetFilters}>
                  Reset filtri
                </button>
              </div>
            </div>
            <div className="stats-row">
              <StatCard label="Prodotti" value={stats.products} />
              <StatCard label="Immagini" value={stats.images} />
              <StatCard label="Prezzi" value={stats.prices} />
              <StatCard label="Sorgenti" value={stats.sources} />
            </div>
            {error && <div className="error-box">{error}</div>}
            <div className="product-list">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  active={selected?.id === product.id}
                  onClick={() => void loadDetail(product.id)}
                />
              ))}
              {!loadingList && filteredProducts.length === 0 && (
                <div className="empty-state">Nessun prodotto trovato.</div>
              )}
            </div>
          </section>
        )}

        {view === "tags" && (
          <TagsView
            error={error}
            statsProducts={stats.products}
            tagsStats={tagsStats}
            selectedTagId={selectedTagId}
            setSelectedTagId={setSelectedTagId}
            selectedSourceSite={selectedSourceSite}
            setSelectedSourceSite={setSelectedSourceSite}
            query={query}
            setQuery={setQuery}
            TAG_KIND_ORDER={TAG_KIND_ORDER}
            TAG_KIND_LABELS={TAG_KIND_LABELS}
            tagsByKind={tagsByKind}
            excludeTagsExpanded={excludeTagsExpanded}
            setExcludeTagsExpanded={setExcludeTagsExpanded}
            excludeTagIds={excludeTagIds}
            toggleExcludeTag={toggleExcludeTag}
            clearExcludeTags={clearExcludeTags}
            tagMap={tagMap}
            filteredProducts={filteredProducts}
            selected={selected}
            loadDetail={loadDetail}
            loadingList={loadingList}
            formatDate={formatDate}
            formatMoney={formatMoney}
            onBack={onBack}
            onRefresh={onRefresh}
          />
        )}

        {view === "sources" && (
          <SourcesView
            sourceWebsitesStats={sourceWebsitesStats}
            totalProducts={stats.products}
            error={error}
            onBack={onBack}
            onRefresh={onRefresh}
            onSelectAll={onSelectAll}
            onSelectSite={onSelectSite}
          />
        )}

        {view === "merge" && (
          <MergeView
            filteredProducts={filteredProducts}
            selected={selected}
            mergeCandidateDetail={mergeCandidateDetail}
            query={query}
            setQuery={setQuery}
            error={error}
            setView={setView}
            loadDetail={loadDetail}
            loadMergeCandidate={loadMergeCandidate}
            commitMerge={commitMerge}
            mergeDraft={mergeDraftState}
            setMergeDraft={setMergeDraftState}
            mergeSelectedImageIds={mergeSelectedImageIds}
            setMergeSelectedImageIds={setMergeSelectedImageIds}
            mergeSelectedPriceIds={mergeSelectedPriceIds}
            setMergeSelectedPriceIds={setMergeSelectedPriceIds}
            mergeSelectedSourceUrlIds={mergeSelectedSourceUrlIds}
            setMergeSelectedSourceUrlIds={setMergeSelectedSourceUrlIds}
            selectedTagId={selectedTagId}
            selectedSourceSite={selectedSourceSite}
            excludeTagIds={excludeTagIds}
          />
        )}
      </main>

      <LightboxViewer
        selected={selected}
        viewerOpen={viewerOpen}
        setViewerOpen={setViewerOpen}
        viewerIndex={viewerIndex}
        moveViewer={moveViewer}
      />

      <CreationModal
        open={creating}
        draft={newProductDraft}
        onClose={() => setCreating(false)}
        onChange={(patch) =>
          setNewProductDraft((d) => ({ ...(d || {}), ...patch }))
        }
        onCreate={createNewProduct}
        tags={tags}
      />

      <footer className="app-footer">Versione: {appVersion}</footer>

      {bundleCreatorOpen && selected && (
        <div className="editing-panel" style={{ marginBottom: 0 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <input className="input" placeholder="Titolo bundle (facoltativo)" value={bundleDraft.title} onChange={(e) => setBundleDraft((current) => ({ ...current, title: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" placeholder="Prezzo bundle" value={bundleDraft.amount} onChange={(e) => setBundleDraft((current) => ({ ...current, amount: e.target.value }))} style={{ width: 140 }} />
              <input className="input" placeholder="EUR" value={bundleDraft.currency} onChange={(e) => setBundleDraft((current) => ({ ...current, currency: e.target.value }))} style={{ width: 100 }} />
            </div>
            <input className="input" placeholder="Link bundle" value={bundleDraft.sourceUrl} onChange={(e) => setBundleDraft((current) => ({ ...current, sourceUrl: e.target.value }))} />
            <textarea className="textarea" placeholder="Note facoltative" value={bundleDraft.notes} onChange={(e) => setBundleDraft((current) => ({ ...current, notes: e.target.value }))} />
            <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 6 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Prodotti nel bundle</div>
              {products.map((product) => {
                const checked = bundleDraft.productIds.includes(product.id);
                return (
                  <label key={`bundle-product-${product.id}`} className={`tag-option ${checked ? 'selected' : ''}`} style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked} onChange={() => setBundleDraft((current) => ({ ...current, productIds: checked ? current.productIds.filter((id) => id !== product.id) : Array.from(new Set([...current.productIds, product.id])) }))} style={{ marginTop: 2 }} />
                    <div style={{ fontSize: 13, lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 600 }}>#{product.id} - {product.title}</div>
                      <div style={{ color: '#94a3b8' }}>{product.origin_type || 'unknown'}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="button primary" onClick={() => void createBundle()}>Crea bundle</button>
              <button className="button secondary" onClick={() => setBundleDraft((current) => ({ ...current, productIds: selected ? [selected.id] : [] }))}>Reset prodotti</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
