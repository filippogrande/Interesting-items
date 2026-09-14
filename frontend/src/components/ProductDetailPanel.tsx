import { formatDate, formatMoney, makeEmptyPrice, makeEmptySourceUrl, derivePlatformLabel, buildTagLabel, TAG_KIND_LABELS } from "../utils/format";
import type { ProductDetail, ProductSummary, Tag } from "../types";
import { useState } from "react";

type BundleDraft = {
  title: string;
  amount: string;
  currency: string;
  sourceUrl: string;
  notes: string;
  productIds: number[];
};

type ProductDetailPanelProps = {
  selected: ProductDetail | null;
  loadingDetail: boolean;
  editing: boolean;
  setEditing: (b: boolean) => void;
  draft: ProductDetail | null;
  setDraft: (d: ProductDetail | null) => void;
  editingTagIds: number[];
  setEditingTagIds: (ids: number[]) => void;
  draftPendingUploads: File[];
  setDraftPendingUploads: (f: File[]) => void;
  draftDeletedImageIds: number[];
  setDraftDeletedImageIds: (ids: number[]) => void;
  error: string | null;
  setError: (e: string | null) => void;
  products: ProductSummary[];
  tags: Tag[];
  tagMap: Map<number, Tag>;
  bundleDraft: BundleDraft;
  setBundleDraft: (d: BundleDraft | ((cur: BundleDraft) => BundleDraft)) => void;
  bundleCreatorOpen: boolean;
  setBundleCreatorOpen: (b: boolean) => void;
  loadDetail: (id: number) => Promise<void>;
  loadProducts: (
    tagId?: number | "" | "untagged",
    sourceSite?: string,
    excludeTags?: number[],
    skipAutoSelect?: boolean,
  ) => Promise<void>;
  duplicateSelectedProduct: () => Promise<void>;
  deleteProductImage: (id: number) => Promise<void>;
  uploadProductImage: (file: File) => Promise<void>;
  appendEditablePair: () => void;
  createBundle: () => Promise<void>;
  createBundleFromPrice: (price: any, idx: number) => Promise<void>;
  moveViewer: (d: number) => void;
  setViewerOpen: (b: boolean) => void;
  setViewerIndex: (i: number) => void;
  formatDate: (s?: string | null) => string;
  formatMoney: (n?: number | null, c?: string | null) => string;
  derivePlatformLabel: (...args: any[]) => string;
  makeEmptyPrice: () => any;
  makeEmptySourceUrl: () => any;
  toggleProductTag: (productId: number, tagId: number, shouldAdd: boolean) => Promise<void>;
  getAncestorIds: (tagId: number) => number[];
  createTag: () => Promise<void>;
  newTagName: string;
  setNewTagName: (s: string) => void;
  newTagKind: Tag["kind"];
  setNewTagKind: (k: Tag["kind"]) => void;
  newTagParentId: number | "";
  setNewTagParentId: (v: number | "") => void;
  tagsByKind: Record<Tag["kind"], Tag[]>;
  selectedTagId: number | "" | "untagged";
  selectedSourceSite: string;
  excludeTagIds: number[];
  imageUploadRef: React.RefObject<HTMLInputElement | null>;
};

export default function ProductDetailPanel({
  selected,
  loadingDetail,
  editing,
  setEditing,
  draft,
  setDraft,
  editingTagIds,
  setEditingTagIds,
  draftPendingUploads,
  setDraftPendingUploads,
  draftDeletedImageIds,
  setDraftDeletedImageIds,
  error,
  setError,
  products,
  tags,
  tagMap,
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
  moveViewer,
  setViewerOpen,
  setViewerIndex,
  formatDate,
  formatMoney,
  derivePlatformLabel,
  makeEmptyPrice,
  makeEmptySourceUrl,
  toggleProductTag,
  getAncestorIds,
  createTag,
  newTagName,
  setNewTagName,
  newTagKind,
  setNewTagKind,
  newTagParentId,
  setNewTagParentId,
  tagsByKind,
  selectedTagId,
  selectedSourceSite,
  excludeTagIds,
  imageUploadRef,
}: ProductDetailPanelProps) {
  const [priceToDelete, setPriceToDelete] = useState<any | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<any | null>(null);

  function startEditing(product: ProductDetail) {
    setEditing(true);
    setDraft(product);
    setEditingTagIds(product.tags.map((t: any) => t.id));
    setDraftPendingUploads([]);
    setDraftDeletedImageIds([]);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(null);
    setDraftPendingUploads([]);
    setDraftDeletedImageIds([]);
  }

  async function handleDeleteProduct() {
    if (!selected) return;
    if (!confirm("Eliminare definitivamente questo prodotto?")) return;
    try {
      const resp = await fetch(`/api/products/${selected.id}`, {
        method: "DELETE",
      });
      if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
      await loadProducts(selectedTagId as number | "" | "untagged", selectedSourceSite);
      await loadProducts(selectedTagId as number | "" | "untagged", selectedSourceSite, excludeTagIds, true);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore eliminazione prodotto");
    }
  }

  async function handleSave() {
    if (!selected || !draft) return;
    setError(null);
    try {
      // product core fields (PATCH)
      const productResp = await fetch(`/api/products/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || "",
          brand: draft.brand || null,
          origin_type: draft.origin_type || null,
          archived: !!draft.archived,
        }),
      });
      if (!productResp.ok) throw new Error(`HTTP ${productResp.status}`);

      // prices + source urls: create new, update existing, delete removed
      const existingPrices = selected.prices || [];
      const existingSources = selected.source_urls || [];
      const draftPrices = draft.prices || [];
      const draftSources = draft.source_urls || [];

      for (let i = 0; i < draftPrices.length; i++) {
        const p = draftPrices[i];
        const src = draftSources[i];
        if (p.id && p.id > 0) {
          await fetch(`/api/prices/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          });
        } else {
          const resp = await fetch(`/api/prices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...p, product_id: selected.id }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        }
        if (src && src.id && src.id > 0) {
          await fetch(`/api/sourceurls/${src.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(src),
          });
        } else if (src && src.url && src.url.trim()) {
          const resp = await fetch(`/api/sourceurls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...src, product_id: selected.id }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        }
      }

      // delete removed prices/sources
      for (const p of existingPrices) {
        if (p.id && !draftPrices.some((d: any) => d.id === p.id)) {
          await fetch(`/api/prices/${p.id}`, { method: "DELETE" });
        }
      }
      for (const s of existingSources) {
        if (s.id && !draftSources.some((d: any) => d.id === s.id)) {
          await fetch(`/api/sourceurls/${s.id}`, { method: "DELETE" });
        }
      }

      // tags: sync editingTagIds on the product
      const currentTagIds = (selected.tags || []).map((t: any) => t.id);
      for (const id of editingTagIds) {
        if (!currentTagIds.includes(id)) {
          await fetch(`/api/products/${selected.id}/tags/${id}`, { method: "POST" });
        }
      }
      for (const id of currentTagIds) {
        if (!editingTagIds.includes(id)) {
          await fetch(`/api/products/${selected.id}/tags/${id}`, { method: "DELETE" });
        }
      }

      // images: upload pending, delete marked
      for (const file of draftPendingUploads) {
        const formData = new FormData();
        formData.append("file", file);
        await fetch(`/api/products/${selected.id}/images/upload`, {
          method: "POST",
          body: formData,
        });
      }
      for (const id of draftDeletedImageIds) {
        await fetch(`/api/images/${id}`, { method: "DELETE" });
      }

      setEditing(false);
      setDraft(null);
      setDraftPendingUploads([]);
      setDraftDeletedImageIds([]);
      await loadProducts(selectedTagId as number | "" | "untagged", selectedSourceSite, excludeTagIds, true);
      await loadDetail(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio prodotto");
    }
  }

  async function handleDeleteRow(idx: number) {
    if (!selected) return;
    if (draft && editing) {
      if (priceToDelete && priceToDelete.id && priceToDelete.id > 0) {
        if (!confirm("Eliminare questa riga?")) return;
        try {
          await fetch(`/api/prices/${priceToDelete.id}`, { method: "DELETE" });
          if (sourceToDelete && sourceToDelete.id && sourceToDelete.id > 0) {
            await fetch(`/api/sourceurls/${sourceToDelete.id}`, { method: "DELETE" });
          }
          await loadDetail(selected.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Errore eliminazione riga");
        }
      } else if (sourceToDelete && sourceToDelete.id && sourceToDelete.id > 0) {
        if (!confirm("Eliminare questa riga?")) return;
        try {
          await fetch(`/api/sourceurls/${sourceToDelete.id}`, { method: "DELETE" });
          await loadDetail(selected.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Errore eliminazione riga");
        }
      } else {
        const copy = { ...draft };
        copy.prices = copy.prices.filter((_: any, i: number) => i !== idx);
        copy.source_urls = copy.source_urls.filter((_: any, i: number) => i !== idx);
        setDraft(copy);
      }
    }
  }

  function toggleEditingTag(tagId: number) {
    const ancestorIds = getAncestorIds(tagId);
    setEditingTagIds((current) => {
      const isOn = current.includes(tagId);
      let next = isOn
        ? current.filter((id) => id !== tagId)
        : Array.from(new Set([...current, ...ancestorIds, tagId]));
      // cascade to descendants of a just-removed tag
      if (isOn) {
        const descendants = tags
          .filter((t) => ancestorIds.includes(tagId) || t.parent_id === tagId)
          .map((t) => t.id);
        next = next.filter((id) => !descendants.includes(id));
      }
      return next;
    });
  }

  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <h2>Dettaglio prodotto</h2>
        {loadingDetail && <span className="muted">Aggiornamento...</span>}
        {selected && !editing && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="button secondary" onClick={() => void duplicateSelectedProduct()}>
              Duplica
            </button>
            <button className="button" onClick={() => startEditing(selected)}>
              Modifica
            </button>
            <button
              title="Elimina prodotto"
              className="button danger"
              onClick={() => void handleDeleteProduct()}
              style={{ padding: "12px 18px", fontSize: 16 }}
            >
              🗑️
            </button>
          </div>
        )}
        {editing && draft && (
          <div>
            <button className="button primary" onClick={() => void handleSave()}>
              Salva
            </button>
            <button className="button secondary" onClick={cancelEditing}>
              Annulla
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {selected ? (
        <>
          <div className="detail-hero">
            <div className="detail-title">
              <span className="badge muted">#{selected.id}</span>
              {editing && draft ? (
                <div>
                  <input
                    className="input"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                  <textarea
                    className="textarea"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                  <input
                    className="input"
                    value={draft.brand || ""}
                    onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                    placeholder="brand"
                  />
                  <label style={{ display: "block", marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!draft.archived}
                      onChange={(e) => setDraft({ ...draft, archived: e.target.checked })}
                    />{" "}
                    Archiviato
                  </label>
                </div>
              ) : (
                <>
                  <h3>{selected.title}</h3>
                  <p>{selected.description}</p>
                </>
              )}
            </div>
            <div className="detail-kpis">
              <div className="kpi">
                <span>Origine</span>
                <strong>{selected.origin_type || "—"}</strong>
              </div>
              <div className="kpi">
                <span>Prezzo</span>
                <strong>{formatMoney(selected.latest_price, selected.latest_currency)}</strong>
              </div>
              <div className="kpi">
                <span>Creato</span>
                <strong>{formatDate(selected.created_at)}</strong>
              </div>
              <div className="kpi">
                <span>Scansionato</span>
                <strong>{formatDate(selected.scraped_at)}</strong>
              </div>
            </div>
          </div>

          {/* Immagini */}
          {(selected.images.length > 0 || editing) && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Immagini</h4>
              <div className="gallery" style={{ margin: 0 }}>
                {selected.images
                  .filter((img: any) => !draftDeletedImageIds.includes(img.id))
                  .map((img: any, i: number) => (
                    <div key={img.id} className="gallery-item" style={{ position: "relative" }}>
                      <img
                        src={img.url}
                        alt={selected.title}
                        style={{ cursor: editing ? "default" : "pointer" }}
                        onClick={() => {
                          if (editing) return;
                          setViewerIndex(i);
                          setViewerOpen(true);
                        }}
                      />
                      {editing && (
                        <button
                          className="button tiny danger"
                          onClick={() => void deleteProductImage(img.id)}
                          style={{ position: "absolute", top: 6, right: 6 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                {editing &&
                  draftPendingUploads.map((file: File, i: number) => (
                    <div key={`pending-${i}`} className="gallery-item" style={{ position: "relative" }}>
                      <img src={URL.createObjectURL(file)} alt="upload" />
                    </div>
                  ))}
                {editing && (
                  <button className="button" onClick={() => imageUploadRef.current?.click()}>
                    + Aggiungi
                  </button>
                )}
              </div>
              <input
                ref={imageUploadRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadProductImage(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {/* Tag */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Tag</h4>
            <div className="tag-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {selected.tags.map((tag: any) => (
                <div key={tag.id} className="tag-pill">
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{tag.name}</span>
                  {editing && (
                    <button
                      className="button tiny danger"
                      onClick={() => toggleEditingTag(tag.id)}
                      style={{ padding: "0px 4px", fontSize: "12px" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!editing && (
                <button
                  className="button tiny"
                  onClick={() => startEditing(selected)}
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  + aggiungi tag
                </button>
              )}
            </div>
            {editing && (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {({ taxonomy: "Taxonomy", store: "Store", project: "Project" } as Record<string, string>)["taxonomy"] &&
                  (["taxonomy", "store", "project"] as Tag["kind"][]).map((kind) => (
                    <div key={kind}>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          fontWeight: 700,
                        }}
                      >
                        {TAG_KIND_LABELS?.[kind] ?? kind}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                        {tagsByKind[kind].map((tag) => {
                          const checked = editingTagIds.includes(tag.id);
                          return (
                            <label
                              key={tag.id}
                              className={`tag-option ${checked ? "selected" : ""}`}
                              style={{ cursor: "pointer" }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEditingTag(tag.id)}
                                style={{ marginTop: 2 }}
                              />
                              <div style={{ fontSize: 13, lineHeight: 1.3 }}>
                                <div style={{ fontWeight: 600 }}>{buildTagLabel(tag, tagMap)}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                <div className="editing-panel" style={{ display: "grid", gap: 8, marginTop: 4 }}>
                  <input
                    className="input"
                    placeholder="Nuovo tag"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                  <select
                    className="input"
                    value={newTagKind}
                    onChange={(e) => setNewTagKind(e.target.value as Tag["kind"])}
                  >
                    <option value="taxonomy">Taxonomy</option>
                    <option value="store">Store</option>
                    <option value="project">Project</option>
                  </select>
                  <select
                    className="input"
                    value={newTagParentId}
                    onChange={(e) => setNewTagParentId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Nessun parent</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <button className="button" onClick={() => void createTag()}>
                    Crea tag
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Prezzi e link */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Prezzi e link</h4>
            <ul className="detail-prices" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {editing && draft
                ? draft.prices.map((price: any, idx: number) => {
                    const source = draft.source_urls[idx];
                    return (
                      <li key={price.id || `new-${idx}`} className="editing-row" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            className="input"
                            style={{ width: 120 }}
                            placeholder="Prezzo"
                            value={price.amount}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                prices: draft.prices.map((p: any, i: number) => (i === idx ? { ...p, amount: Number(e.target.value) || p.amount } : p)),
                              })
                            }
                          />
                          <input
                            className="input"
                            style={{ width: 90 }}
                            placeholder="EUR"
                            value={price.currency}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                prices: draft.prices.map((p: any, i: number) => (i === idx ? { ...p, currency: e.target.value } : p)),
                              })
                            }
                          />
                          <input
                            className="input"
                            placeholder="Link"
                            value={source?.url || ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                source_urls: draft.source_urls.map((s: any, i: number) => (i === idx ? { ...s, url: e.target.value } : s)),
                              })
                            }
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={!!price.sold}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  prices: draft.prices.map((p: any, i: number) => (i === idx ? { ...p, sold: e.target.checked } : p)),
                                })
                              }
                            />
                            Venduto
                          </label>
                          <button
                            className="button tiny danger"
                            onClick={() => {
                              setPriceToDelete(price);
                              setSourceToDelete(source || null);
                              void handleDeleteRow(idx);
                            }}
                          >
                            Elimina
                          </button>
                        </div>
                      </li>
                    );
                  })
                : (selected.prices || []).map((price: any, idx: number) => (
                    <li key={price.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <strong>{formatMoney(price.amount, price.currency)}</strong>
                          <div style={{ fontSize: 12 }}>{derivePlatformLabel(price, selected.source_urls[idx])}</div>
                          <small>{formatDate(price.added_at)}</small>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                          {selected.source_urls[idx] && (
                            <div>
                              <a href={selected.source_urls[idx].url} target="_blank" rel="noreferrer">
                                {derivePlatformLabel(undefined, selected.source_urls[idx])}
                              </a>
                              <div>
                                <small>{formatDate(selected.source_urls[idx].added_at)}</small>
                              </div>
                            </div>
                          )}
                          <div>
                            <button className="button tiny" onClick={() => void createBundleFromPrice(price, idx)}>
                              Trasforma in bundle
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}

              {/* extra source_urls when there are more sources than prices */}
              {!editing &&
                selected.source_urls.length > (selected.prices || []).length &&
                selected.source_urls.slice((selected.prices || []).length).map((source: any) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {derivePlatformLabel(undefined, source)}
                    </a>
                    <small>{formatDate(source.added_at)}</small>
                  </li>
                ))}

              {(selected || editing) && (
                <li className={editing ? "editing-row" : undefined}>
                  <button className="button" onClick={() => appendEditablePair()}>
                    +
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Bundle */}
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Bundle</h4>
              <button className="button secondary" onClick={() => setBundleCreatorOpen((current) => !current)}>
                {bundleCreatorOpen ? "Chiudi crea bundle" : "+ Crea bundle"}
              </button>
            </div>

            {selected.bundles && selected.bundles.length > 0 ? (
              <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                {selected.bundles.map((bundle: any) => (
                  <div
                    key={bundle.id}
                    style={{ padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <strong>{bundle.title}</strong>
                      <span className="badge muted">{formatMoney(bundle.amount, bundle.currency)}</span>
                    </div>
                    <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                      <a href={bundle.source_url} target="_blank" rel="noreferrer">
                        {bundle.source_domain || bundle.source_url}
                      </a>
                      <small style={{ color: "#94a3b8" }}>{bundle.product_ids.length} prodotti nel bundle</small>
                      {bundle.notes && <small style={{ color: "#94a3b8" }}>{bundle.notes}</small>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ marginBottom: 12 }}>
                Nessun bundle collegato.
              </div>
            )}

            {bundleCreatorOpen && (
              <div className="editing-panel" style={{ marginBottom: 0 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <input
                    className="input"
                    placeholder="Titolo bundle (facoltativo)"
                    value={bundleDraft.title}
                    onChange={(e) => setBundleDraft((current) => ({ ...current, title: e.target.value }))}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      className="input"
                      placeholder="Prezzo bundle"
                      value={bundleDraft.amount}
                      onChange={(e) => setBundleDraft((current) => ({ ...current, amount: e.target.value }))}
                      style={{ width: 140 }}
                    />
                    <input
                      className="input"
                      placeholder="EUR"
                      value={bundleDraft.currency}
                      onChange={(e) => setBundleDraft((current) => ({ ...current, currency: e.target.value }))}
                      style={{ width: 100 }}
                    />
                  </div>
                  <input
                    className="input"
                    placeholder="Link bundle"
                    value={bundleDraft.sourceUrl}
                    onChange={(e) => setBundleDraft((current) => ({ ...current, sourceUrl: e.target.value }))}
                  />
                  <textarea
                    className="textarea"
                    placeholder="Note facoltative"
                    value={bundleDraft.notes}
                    onChange={(e) => setBundleDraft((current) => ({ ...current, notes: e.target.value }))}
                  />

                  <div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto", paddingRight: 6 }}>
                    <div style={{ fontSize: 12, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>
                      Prodotti nel bundle
                    </div>
                    {products.map((product) => {
                      const checked = bundleDraft.productIds.includes(product.id);
                      return (
                        <label key={`bundle-product-${product.id}`} className={`tag-option ${checked ? "selected" : ""}`} style={{ cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setBundleDraft((current) => ({
                                ...current,
                                productIds: checked
                                  ? current.productIds.filter((id) => id !== product.id)
                                  : Array.from(new Set([...current.productIds, product.id])),
                              }))
                            }
                            style={{ marginTop: 2 }}
                          />
                          <div style={{ fontSize: 13, lineHeight: 1.3 }}>
                            <div style={{ fontWeight: 600 }}>#{product.id} - {product.title}</div>
                            <div style={{ color: "#94a3b8" }}>{product.origin_type || "unknown"}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="button primary" onClick={() => void createBundle()}>
                      Crea bundle
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setBundleDraft((current) => ({ ...current, productIds: selected ? [selected.id] : [] }))}
                    >
                      Reset prodotti
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">Seleziona un prodotto per vedere i dettagli.</div>
      )}
    </section>
  );
}
