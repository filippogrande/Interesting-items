import React from "react";
import { Kpi } from "./Stats";
import { formatDate, formatMoney, makeEmptyPrice, makeEmptySourceUrl, derivePlatformLabel } from "../utils/format";

type ProductDetailPanelProps = {
  selected: any;
  loadingDetail: boolean;
  editing: boolean;
  setEditing: (b: boolean) => void;
  draft: any;
  setDraft: (d: any) => void;
  editingTagIds: number[];
  setEditingTagIds: (fn: any) => void;
  newTagName: string;
  setNewTagName: (s: string) => void;
  newTagKind: any;
  setNewTagKind: (k: any) => void;
  newTagParentId: number | "";
  setNewTagParentId: (v: number | "") => void;
  draftPendingUploads: File[];
  setDraftPendingUploads: (fn: any) => void;
  draftDeletedImageIds: number[];
  setDraftDeletedImageIds: (fn: any) => void;
  imageUploadRef: any;
  error: string | null;
  setError: (e: string | null) => void;
  products: any[];
  tags: any[];
  tagMap: Map<number, any>;
  tagsByKind: Record<string, any[]>;
  bundleDraft: any;
  setBundleDraft: (fn: any) => void;
  bundleCreatorOpen: boolean;
  setBundleCreatorOpen: (fn: any) => void;
  loadDetail: (id: number) => Promise<void>;
  loadProducts: (tagId?: any, sourceSite?: string, excludeTags?: number[], skipAutoSelect?: boolean) => Promise<void>;
  duplicateSelectedProduct: () => Promise<void>;
  deleteProductImage: (id: number) => Promise<void>;
  uploadProductImage: (file: File) => Promise<void>;
  appendEditablePair: () => void;
  createBundle: () => Promise<void>;
  createBundleFromPrice: (price: any, idx: number) => Promise<void>;
  toggleProductTag: (productId: number, tagId: number, add: boolean) => Promise<void>;
  getAncestorIds: (tagId: number) => number[];
  createTag: () => Promise<void>;
  setSelected?: (p: any) => void;
  setViewerIndex: (n: number) => void;
  setViewerOpen: (b: boolean) => void;
  TAG_KIND_ORDER: string[];
  TAG_KIND_LABELS: Record<string, string>;
  selectedTagId: any;
  selectedSourceSite: string;
  excludeTagIds: number[];
};

export default function ProductDetailPanel(props: ProductDetailPanelProps) {
  const {
    selected,
    loadingDetail,
    editing,
    setEditing,
    draft,
    setDraft,
    editingTagIds,
    setEditingTagIds,
    newTagName,
    setNewTagName,
    newTagKind,
    setNewTagKind,
    newTagParentId,
    setNewTagParentId,
    draftPendingUploads,
    setDraftPendingUploads,
    draftDeletedImageIds,
    setDraftDeletedImageIds,
    imageUploadRef,
    setError,
    products,
    tags,
    tagsByKind,
    bundleDraft,
    setBundleDraft,
    bundleCreatorOpen,
    setBundleCreatorOpen,
    loadDetail,
    loadProducts,
    duplicateSelectedProduct,
    deleteProductImage,
    uploadProductImage,
    appendEditablePair,
    createBundle,
    createBundleFromPrice,
    toggleProductTag,
    getAncestorIds,
    createTag,
    setSelected,
    setViewerIndex,
    setViewerOpen,
    TAG_KIND_ORDER,
    TAG_KIND_LABELS,
    selectedTagId,
    selectedSourceSite,
    excludeTagIds,
  } = props;
  return (
<section className="panel detail-panel">
  <div className="panel-header">
    <h2>Dettaglio prodotto</h2>
    {loadingDetail && <span className="muted">Aggiornamento...</span>}
    {selected && !editing && (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="button secondary" onClick={() => void duplicateSelectedProduct()}>Duplica</button>
        <button className="button" onClick={() => { setEditing(true); setDraft(selected); setEditingTagIds(selected.tags.map((t) => t.id)); setDraftPendingUploads([]); setDraftDeletedImageIds([]); }}>Modifica</button>
        <button title="Elimina prodotto" className="button danger" onClick={async () => { if (!selected) return; if (!confirm("Eliminare definitivamente questo prodotto?")) return; try { const resp = await fetch(`/api/products/${selected.id}`, { method: "DELETE" }); if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`); await loadProducts(selectedTagId, selectedSourceSite, undefined, true); setSelected?.(null); setDraft(null); } catch (err) { setError(err instanceof Error ? err.message : "Errore eliminazione prodotto"); } }} style={{ padding: "12px 18px", fontSize: 16 }}>🗑️</button>
      </div>
    )}
    {editing && (
      <div>
        <button className="button primary" onClick={async () => {
          if (!draft || !selected) return;
          try {
            await fetch(`/api/products/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title, description: draft.description, brand: draft.brand, archived: draft.archived }) });
            await fetch(`/api/products/${selected.id}/tags`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag_ids: editingTagIds }) });
            for (const [index, p] of draft.prices.entries()) {
              const source = draft.source_urls[index];
              const isEmptyRow = p.id === 0 && p.amount === 0 && !p.platform && !(source?.url || "").trim();
              if (isEmptyRow) continue;
              if (p.id && p.id > 0) { await fetch(`/api/prices/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }); }
              else { await fetch(`/api/prices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, product_id: selected.id }) }); }
            }
            for (const s of draft.source_urls) {
              if (s.id === 0 && !(s.url || "").trim()) continue;
              if (s.id && s.id > 0) { await fetch(`/api/sourceurls/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }); }
              else { await fetch(`/api/sourceurls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, product_id: selected.id }) }); }
            }
            if (draftDeletedImageIds.length > 0) { for (const imgId of draftDeletedImageIds) { try { await fetch(`/api/images/${imgId}`, { method: "DELETE" }); } catch (e) { console.warn("Errore eliminazione immagine durante salvataggio", imgId, e); } } }
            if (draftPendingUploads.length > 0) { for (const file of draftPendingUploads) { try { const fd = new FormData(); fd.append("file", file); const res = await fetch(`/api/products/${selected.id}/images/upload`, { method: "POST", body: fd }); if (!res.ok) throw new Error(`HTTP ${res.status}`); } catch (e) { console.warn("Errore upload immagine durante salvataggio", e); } } }
            setDraftPendingUploads([]); setDraftDeletedImageIds([]);
            await loadProducts(selectedTagId, selectedSourceSite, excludeTagIds, true);
            await loadDetail(selected.id);
            const saved = selected;
            if (saved) {
              const matchesFilter = selectedTagId === "" ? true : selectedTagId === "untagged" ? saved.tags.length === 0 : saved.tags.some((t) => t.id === selectedTagId);
              if (!matchesFilter) { setSelected?.(null); setDraft(null); }
            }
          } catch (err) { console.error(err); setError(err instanceof Error ? err.message : "Errore salvataggio"); }
          finally { setEditing(false); setDraft(null); setDraftPendingUploads([]); setDraftDeletedImageIds([]); }
        }}>Salva</button>
        <button className="button secondary" onClick={() => { setEditing(false); setDraft(null); setDraftPendingUploads([]); setDraftDeletedImageIds([]); }}>Annulla</button>
      </div>
    )}
  </div>
  {selected ? (
    <>
      <div className="detail-hero">
        <div className="detail-title">
          <span className="badge muted">#{selected.id}</span>
          {editing && draft ? (
            <div>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea className="textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <input className="input" value={draft.brand || ""} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="brand" />
              <label style={{ display: "block", marginTop: 8 }}><input type="checkbox" checked={draft.archived} onChange={(e) => setDraft({ ...draft, archived: e.target.checked })} /> Archiviato</label>
            </div>
          ) : (
            <><h3>{selected.title}</h3><p>{selected.description}</p></>
          )}
        </div>
        <div className="detail-kpis">
          <Kpi label="Origine" value={selected.origin_type || "—"} />
          <Kpi label="Prezzo" value={formatMoney(selected.latest_price, selected.latest_currency)} />
          <Kpi label="Creato" value={formatDate(selected.created_at)} />
          <Kpi label="Scansionato" value={formatDate(selected.scraped_at)} />
        </div>
      </div>
      {(selected.tags.length > 0 || !editing) && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Tag</h4>
          <div className="tag-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {selected.tags.map((tag) => (
              <div key={tag.id} className="tag-pill"><span style={{ fontSize: "14px", fontWeight: 500 }}>{tag.name}</span><button className="button tiny danger" onClick={() => toggleProductTag(selected.id, tag.id, false)} style={{ padding: "0px 4px", fontSize: "12px" }}>×</button></div>
            ))}
            {!editing && (<button className="button tiny" onClick={() => { setEditing(true); setDraft(selected); setEditingTagIds(selected.tags.map((t) => t.id)); }} style={{ padding: "4px 8px", fontSize: "12px" }}>+ aggiungi tag</button>)}
          </div>
        </div>
      )}
      {editing && (
        <div className="editing-panel">
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Aggiungi tag</h4>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>(I parent si aggiungono automaticamente)</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
              <input className="input" placeholder="Nome nuovo tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} style={{ flex: 1 }} />
              <select value={newTagKind} onChange={(e) => setNewTagKind(e.target.value)} className="input" style={{ width: 150 }}><option value="taxonomy">taxonomy</option><option value="store">store</option><option value="project">project</option></select>
              <select value={newTagParentId} onChange={(e) => setNewTagParentId(e.target.value ? Number(e.target.value) : "")} className="input" style={{ width: 180 }}><option value="">Nessun parent</option>{TAG_KIND_ORDER.map((kind) => tagsByKind[kind].length > 0 ? (<optgroup key={kind} label={`${TAG_KIND_LABELS[kind]}:`}>{tagsByKind[kind].map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</optgroup>) : null)}</select>
              <button className="button primary" onClick={createTag}>Crea</button>
            </div>
            {tags.length === 0 ? (<p style={{ gridColumn: "1 / -1" }}>Nessun tag disponibile</p>) : (
              TAG_KIND_ORDER.flatMap((kind) => {
                if (tagsByKind[kind].length === 0) return [];
                return [<div key={`${kind}-header`} style={{ gridColumn: "1 / -1", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "#4a5568", marginTop: 6 }}>{TAG_KIND_LABELS[kind]}</div>, ...tagsByKind[kind].map((tag) => {
                  const isSelected = editingTagIds.includes(tag.id);
                  return (<label key={tag.id} className={`tag-option ${isSelected ? "selected" : ""}`}><input type="checkbox" checked={isSelected} onChange={(e) => { if (e.target.checked) { setEditingTagIds((prev) => { const ancestors = getAncestorIds(tag.id); const merged = new Set([...prev, ...ancestors, tag.id]); return Array.from(merged); }); } else { setEditingTagIds((prev) => prev.filter((id) => id !== tag.id)); } }} style={{ marginTop: 2 }} /><div style={{ fontSize: "13px", lineHeight: "1.3" }}><div style={{ fontWeight: 600 }}>{tag.name}</div></div></label>);
                })];
              })
            )}
          </div>
        </div>
      )}
      <div className="gallery">
        {(editing && draft ? draft.images : selected.images).map((image) => {
          const marked = draftDeletedImageIds.includes(image.id);
          return (<div key={image.id} className="gallery-item" style={{ position: "relative", opacity: marked ? 0.4 : 1 }}>{editing && (<button className={`button tiny ${marked ? "" : "danger"}`} onClick={() => { void deleteProductImage(image.id).catch((err) => { setError(err instanceof Error ? err.message : "Errore cancellazione immagine"); }); }} style={{ position: "absolute", top: 8, right: 8, zIndex: 2, padding: "2px 6px", lineHeight: 1 }} aria-label={marked ? "Annulla eliminazione immagine" : "Elimina immagine"} title={marked ? "Annulla eliminazione immagine" : "Elimina immagine"}>{marked ? "↺" : "×"}</button>)}{image.url ? (<a href={image.url} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); const idx = (editing && draft ? draft.images : selected.images).findIndex((i) => i.id === image.id); setViewerIndex(idx >= 0 ? idx : 0); setViewerOpen(true); }}><img src={image.url} alt={selected?.title} /></a>) : (<div className="placeholder">No image</div>)}{marked && editing && (<div style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 6, fontSize: 12 }}>Marked for deletion</div>)}</div>);
        })}
        {editing && draftPendingUploads.map((file, idx) => {
          const url = URL.createObjectURL(file);
          return (<div key={`pending-${idx}`} className="gallery-item" style={{ position: "relative" }}><button className="button tiny" onClick={() => setDraftPendingUploads((cur) => cur.filter((_, i) => i !== idx))} style={{ position: "absolute", top: 8, right: 8, zIndex: 2, padding: "2px 6px", lineHeight: 1 }} aria-label="Rimuovi immagine in attesa" title="Rimuovi immagine in attesa">×</button><img src={url} alt={`pending-${idx}`} /><div style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 6, fontSize: 12 }}>In attesa di salvataggio</div></div>);
        })}
        {editing && (<div className="gallery-item" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><input ref={imageUploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; void uploadProductImage(file).catch((err) => { setError(err instanceof Error ? err.message : "Errore upload immagine"); }); }} /><button className="button" onClick={() => imageUploadRef.current?.click()} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>+</button></div>)}
        {!selected.images.length && !editing && (<div className="empty-state">Nessuna immagine disponibile.</div>)}
      </div>
      <div className="two-columns">
        <div style={{ gridColumn: "1 / -1" }}>
          <h4>Prezzi e link</h4>
          <ul className="info-list prices-grid">
            {editing && draft ? Array.from({ length: Math.max(draft.prices.length, draft.source_urls.length) }).map((_, idx) => {
              const currentPrice = draft.prices[idx] ?? null;
              const currentSource = draft.source_urls[idx] ?? null;
              return (<li key={`pair-${idx}`} className="editing-row"><div style={{ display: "grid", gap: 8, width: "100%" }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="text" placeholder="0,00" value={String(currentPrice?.amount ?? 0)} onChange={(e) => { const normalized = e.target.value.trim().replace(/,/g, "."); const amount = normalized === "" ? 0 : Number.parseFloat(normalized); if (Number.isNaN(amount)) return; const copy = { ...draft }; copy.prices[idx] = { ...(currentPrice ?? makeEmptyPrice()), amount }; setDraft(copy); }} className="input" style={{ width: 110 }} /><input value={currentPrice?.currency ?? "EUR"} onChange={(e) => { const copy = { ...draft }; copy.prices[idx] = { ...(currentPrice ?? makeEmptyPrice()), currency: e.target.value }; setDraft(copy); }} className="input" style={{ width: 80 }} /><input value={currentPrice?.platform ?? ""} onChange={(e) => { const copy = { ...draft }; copy.prices[idx] = { ...(currentPrice ?? makeEmptyPrice()), platform: e.target.value }; setDraft(copy); }} placeholder="piattaforma" className="input" style={{ flex: 1, minWidth: 140 }} /></div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><input value={currentSource?.url ?? ""} onChange={(e) => { const copy = { ...draft }; copy.source_urls[idx] = { ...(currentSource ?? makeEmptySourceUrl()), url: e.target.value }; setDraft(copy); }} placeholder="link annuncio" className="input" style={{ flex: 1, minWidth: 240 }} /><button className="button tiny danger" onClick={async () => { const priceToDelete = draft.prices[idx]; const sourceToDelete = draft.source_urls[idx]; if (priceToDelete?.id && priceToDelete.id > 0) { if (!confirm("Eliminare questa riga?")) return; try { await fetch(`/api/prices/${priceToDelete.id}`, { method: "DELETE" }); if (sourceToDelete?.id && sourceToDelete.id > 0) { await fetch(`/api/sourceurls/${sourceToDelete.id}`, { method: "DELETE" }); } await loadDetail(selected.id); } catch (err) { setError(err instanceof Error ? err.message : "Errore eliminazione riga"); } } else if (sourceToDelete?.id && sourceToDelete.id > 0) { if (!confirm("Eliminare questa riga?")) return; try { await fetch(`/api/sourceurls/${sourceToDelete.id}`, { method: "DELETE" }); await loadDetail(selected.id); } catch (err) { setError(err instanceof Error ? err.message : "Errore eliminazione riga"); } } else { const copy = { ...draft }; copy.prices = copy.prices.filter((_, i) => i !== idx); copy.source_urls = copy.source_urls.filter((_, i) => i !== idx); setDraft(copy); } }}>Elimina</button></div></div></li>);
            }) : selected.prices.map((price, idx) => (<li key={price.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div><strong>{formatMoney(price.amount, price.currency)}</strong><div style={{ fontSize: 12 }}>{derivePlatformLabel(price, selected.source_urls[idx])}</div><small>{formatDate(price.added_at)}</small></div><div style={{ display: "flex", gap: 8, flexDirection: "column" }}>{selected.source_urls[idx] && (<div><a href={selected.source_urls[idx].url} target="_blank" rel="noreferrer">{derivePlatformLabel(undefined, selected.source_urls[idx])}</a><div><small>{formatDate(selected.source_urls[idx].added_at)}</small></div></div>)}<div><button className="button tiny" onClick={() => void createBundleFromPrice(price, idx)}>Trasforma in bundle</button></div></div></div></li>))}
            {!editing && selected.source_urls.length > selected.prices.length && selected.source_urls.slice(selected.prices.length).map((source) => (<li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{derivePlatformLabel(undefined, source)}</a><small>{formatDate(source.added_at)}</small></li>))}
            {(selected || editing) && (<li className={editing ? "editing-row" : undefined}><button className="button" onClick={appendEditablePair}>+</button></li>)}
          </ul>
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}><h4 style={{ margin: 0 }}>Bundle</h4><button className="button secondary" onClick={() => setBundleCreatorOpen((current) => !current)}>{bundleCreatorOpen ? "Chiudi crea bundle" : "+ Crea bundle"}</button></div>
            {selected.bundles.length > 0 ? (<div style={{ display: "grid", gap: 10, marginBottom: 12 }}>{selected.bundles.map((bundle) => (<div key={bundle.id} style={{ padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{bundle.title}</strong><span className="badge muted">{formatMoney(bundle.amount, bundle.currency)}</span></div><div style={{ marginTop: 6, display: "grid", gap: 6 }}><a href={bundle.source_url} target="_blank" rel="noreferrer">{bundle.source_domain || bundle.source_url}</a><small style={{ color: "#94a3b8" }}>{bundle.product_ids.length} prodotti nel bundle</small>{bundle.notes && (<small style={{ color: "#94a3b8" }}>{bundle.notes}</small>)}</div></div>))}</div>) : (<div className="empty-state" style={{ marginBottom: 12 }}>Nessun bundle collegato.</div>)}
            {bundleCreatorOpen && (<div className="editing-panel" style={{ marginBottom: 0 }}><div style={{ display: "grid", gap: 10 }}><input className="input" placeholder="Titolo bundle (facoltativo)" value={bundleDraft.title} onChange={(e) => setBundleDraft((current) => ({ ...current, title: e.target.value }))} /><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input className="input" placeholder="Prezzo bundle" value={bundleDraft.amount} onChange={(e) => setBundleDraft((current) => ({ ...current, amount: e.target.value }))} style={{ width: 140 }} /><input className="input" placeholder="EUR" value={bundleDraft.currency} onChange={(e) => setBundleDraft((current) => ({ ...current, currency: e.target.value }))} style={{ width: 100 }} /></div><input className="input" placeholder="Link bundle" value={bundleDraft.sourceUrl} onChange={(e) => setBundleDraft((current) => ({ ...current, sourceUrl: e.target.value }))} /><textarea className="textarea" placeholder="Note facoltative" value={bundleDraft.notes} onChange={(e) => setBundleDraft((current) => ({ ...current, notes: e.target.value }))} /><div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto", paddingRight: 6 }}><div style={{ fontSize: 12, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>Prodotti nel bundle</div>{products.map((product) => { const checked = bundleDraft.productIds.includes(product.id); return (<label key={`bundle-product-${product.id}`} className={`tag-option ${checked ? "selected" : ""}`} style={{ cursor: "pointer" }}><input type="checkbox" checked={checked} onChange={() => setBundleDraft((current) => ({ ...current, productIds: checked ? current.productIds.filter((id) => id !== product.id) : Array.from(new Set([...current.productIds, product.id])) }))} style={{ marginTop: 2 }} /><div style={{ fontSize: 13, lineHeight: 1.3 }}><div style={{ fontWeight: 600 }}>#{product.id} - {product.title}</div><div style={{ color: "#94a3b8" }}>{product.origin_type || "unknown"}</div></div></label>); })}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="button primary" onClick={() => void createBundle()}>Crea bundle</button><button className="button secondary" onClick={() => setBundleDraft((current) => ({ ...current, productIds: selected ? [selected.id] : [] }))}>Reset prodotti</button></div></div></div>)}
          </div>
        </div>
      </div>
    </>
  ) : (
    <div className="empty-state">Seleziona un prodotto per vedere i dettagli.</div>
  )}
</section>
  );
}