import React from "react";
import { Kpi } from "./dashboard";

export default function ProductDetail(props: any) {
  const {
    selected,
    loadingDetail,
    editing,
    draft,
    duplicateSelectedProduct,
    setEditing,
    setDraft,
    setEditingTagIds,
    setDraftPendingUploads,
    setDraftDeletedImageIds,
    loadProducts,
    selectedTagId,
    selectedSourceSite,
    setSelected,
    setError,
    loadDetail,
    draftDeletedImageIds,
    draftPendingUploads,
    deleteProductImage,
    uploadProductImage,
    setViewerIndex,
    setViewerOpen,
    appendEditablePair,
    formatDate,
    formatMoney,
    toggleProductTag,
    getAncestorIds,
    createTag,
    newTagName,
    setNewTagName,
    newTagKind,
    setNewTagKind,
    newTagParentId,
    setNewTagParentId,
    TAG_KIND_ORDER,
    tagsByKind,
    tags,
    editingTagIds,
    setEditingTagIds,
    bundleCreatorOpen,
    setBundleCreatorOpen,
    bundleDraft,
    setBundleDraft,
    createBundleFromPrice,
    createBundle,
    products,
    imageUploadRef,
    setLoadingList,
  } = props;

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
            <button
              className="button"
              onClick={() => {
                setEditing(true);
                setDraft(selected);
                setEditingTagIds(selected.tags.map((t: any) => t.id));
                setDraftPendingUploads([]);
                setDraftDeletedImageIds([]);
              }}
            >
              Modifica
            </button>
            <script dangerouslySetInnerHTML={{ __html: "" }} />
            <button
              title="Elimina prodotto"
              className="button danger"
              onClick={async () => {
                if (!selected) return;
                if (!confirm("Eliminare definitivamente questo prodotto?")) return;
                try {
                  const resp = await fetch(`/api/products/${selected.id}`, { method: "DELETE" });
                  if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
                  await loadProducts(selectedTagId as number | "" | "untagged", selectedSourceSite);
                  setSelected(null);
                  setDraft(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Errore eliminazione prodotto");
                }
              }}
              style={{ padding: "12px 18px", fontSize: 16 }}
            >
              🗑️
            </button>
          </div>
        )}
        {editing && (
          <div>
            <button className="button primary" onClick={async () => props.onSave && props.onSave()}>
              Salva
            </button>
            <button className="button secondary" onClick={() => {
              setEditing(false);
              setDraft(null);
              setDraftPendingUploads([]);
              setDraftDeletedImageIds([]);
            }}>
              Annulla
            </button>
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
                  <label style={{ display: "block", marginTop: 8 }}>
                    <input type="checkbox" checked={draft.archived} onChange={(e) => setDraft({ ...draft, archived: e.target.checked })} /> Archiviato
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
                {selected.tags.map((tag: any) => (
                  <div key={tag.id} className="tag-pill">
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>{tag.name}</span>
                    <button className="button tiny danger" onClick={() => toggleProductTag(selected.id, tag.id, false)} style={{ padding: "0px 4px", fontSize: "12px" }}>×</button>
                  </div>
                ))}
                {!editing && (
                  <button className="button tiny" onClick={() => { setEditing(true); setDraft(selected); setEditingTagIds(selected.tags.map((t: any) => t.id)); }} style={{ padding: "4px 8px", fontSize: "12px" }}>
                    + aggiungi tag
                  </button>
                )}
              </div>
            </div>
          )}

          {/* For brevity: rest of detail view reuses parent's handlers via props */}
        </>
      ) : (
        <div className="empty-state">Seleziona un prodotto per vedere i dettagli.</div>
      )}
    </section>
  );
}
