import React from "react";
import ProductCard from "./ProductCard";

type MergeViewProps = {
  filteredProducts: any[];
  selected: any | null;
  mergeCandidateDetail: any | null;
  query: string;
  setQuery: (value: string) => void;
  error: string | null;
  setView: (view: "dashboard" | "tags" | "sources" | "merge") => void;
  loadDetail: (id: number) => void;
  loadMergeCandidate: (id: number) => void;
  commitMerge: () => void;
  mergeDraft: any;
  setMergeDraft: (updater: (current: any) => any) => void;
  mergeSelectedImageIds: number[];
  setMergeSelectedImageIds: (updater: (current: number[]) => number[]) => void;
  mergeSelectedPriceIds: number[];
  setMergeSelectedPriceIds: (updater: (current: number[]) => number[]) => void;
  mergeSelectedSourceUrlIds: number[];
  setMergeSelectedSourceUrlIds: (updater: (current: number[]) => number[]) => void;
  derivePlatformLabel: (price?: any, source?: any) => string;
  formatMoney: (amount?: number | null, currency?: string | null) => string;
  selectedTagId: number | "" | "untagged";
  selectedSourceSite: string;
  excludeTagIds: number[];
};

function MergeSelectedSummary({ entity }: { entity: any }) {
  if (!entity) return <div className="empty-state" style={{ position: "sticky", top: 0 }}>Seleziona il prodotto.</div>;
  return (
    <div style={{
      display: "grid", gap: 10, position: "sticky", top: 0,
      background: "var(--bg, #0f1115)", padding: "10px 0", zIndex: 2,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div className="kpi"><span>Selezionato</span><strong>#{entity.id} - {entity.title}</strong></div>
      <div className="kpi"><span>Descrizione</span><strong>{entity.description}</strong></div>
      <div className="kpi"><span>Immagini / Prezzi</span><strong>{entity.images.length} / {entity.prices.length}</strong></div>
    </div>
  );
}

function MergeImportPanel(props: MergeViewProps) {
  const { mergeCandidateDetail, mergeSelectedImageIds, setMergeSelectedImageIds,
    mergeSelectedPriceIds, setMergeSelectedPriceIds, mergeSelectedSourceUrlIds,
    setMergeSelectedSourceUrlIds, derivePlatformLabel, formatMoney } = props;
  if (!mergeCandidateDetail) {
    return <div className="empty-state">Seleziona il prodotto di destra per importare immagini, prezzi e link.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={labelStyle}>Immagini</div>
        <div className="gallery" style={{ margin: 0 }}>
          {mergeCandidateDetail.images.map((image: any) => {
            const checked = mergeSelectedImageIds.includes(image.id);
            return (
              <label key={`merge-image-${image.id}`} className="gallery-item" style={{ position: "relative", display: "block", cursor: "pointer", border: checked ? "2px solid rgba(96,165,250,0.9)" : undefined }}>
                <input type="checkbox" checked={checked} onChange={() => setMergeSelectedImageIds((c) => c.includes(image.id) ? c.filter((id) => id !== image.id) : [...c, image.id])} style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }} />
                {image.url ? <img src={image.url} alt={mergeCandidateDetail.title} /> : <div className="placeholder">No image</div>}
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <div style={labelStyle}>Prezzi</div>
        <div style={{ display: "grid", gap: 8 }}>
          {mergeCandidateDetail.prices.map((price: any) => {
            const checked = mergeSelectedPriceIds.includes(price.id);
            const relatedSource = mergeCandidateDetail.source_urls[0] || null;
            return (
              <label key={`merge-price-${price.id}`} className={`tag-option ${checked ? "selected" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => setMergeSelectedPriceIds((c) => c.includes(price.id) ? c.filter((id) => id !== price.id) : [...c, price.id])} style={{ marginTop: 2 }} />
                <div style={{ display: "grid", gap: 4 }}><strong>{formatMoney(price.amount, price.currency)}</strong><span>{derivePlatformLabel(price, relatedSource)}</span></div>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <div style={labelStyle}>Link</div>
        <div style={{ display: "grid", gap: 8 }}>
          {mergeCandidateDetail.source_urls.map((source: any) => {
            const checked = mergeSelectedSourceUrlIds.includes(source.id);
            return (
              <label key={`merge-source-${source.id}`} className={`tag-option ${checked ? "selected" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => setMergeSelectedSourceUrlIds((c) => c.includes(source.id) ? c.filter((id) => id !== source.id) : [...c, source.id])} style={{ marginTop: 2 }} />
                <div style={{ display: "grid", gap: 4 }}><a href={source.url} target="_blank" rel="noreferrer">{derivePlatformLabel(undefined, source)}</a><small>{source.url}</small></div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700, marginBottom: 8 } as const;

function MergeFieldRow({ field, label, selected, mergeCandidateDetail, mergeDraft, setMergeDraft }: any) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ minWidth: 110, ...labelStyle }}>{label}</span>
        <button className="button tiny" onClick={() => setMergeDraft((c: any) => ({ ...c, [field]: selected ? (selected as any)[field] || "" : "" }))}>Sinistra</button>
        <button className="button tiny" onClick={() => setMergeDraft((c: any) => ({ ...c, [field]: mergeCandidateDetail ? (mergeCandidateDetail as any)[field] || "" : "" }))}>Destra</button>
      </div>
      {field === "description" ? (
        <textarea className="textarea" value={mergeDraft.description} onChange={(e) => setMergeDraft((c: any) => ({ ...c, description: e.target.value }))} />
      ) : (
        <input className="input" value={(mergeDraft as any)[field]} onChange={(e) => setMergeDraft((c: any) => ({ ...c, [field]: e.target.value }))} />
      )}
    </div>
  );
}

export default function MergeView(props: MergeViewProps) {
  const {
    filteredProducts, selected, mergeCandidateDetail, query, setQuery, error, setView,
    loadDetail, loadMergeCandidate, commitMerge, mergeDraft, setMergeDraft,
  } = props;

  return (
    <section className="panel list-panel" style={{ gridColumn: "1 / -1" }}>
      <div className="panel-header">
        <h2>Unisci i prodotti</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button secondary" onClick={() => setView("dashboard")}>Indietro</button>
          <button className="button primary" onClick={() => void commitMerge()} disabled={!selected || !mergeCandidateDetail}>Salva merge</button>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div style={{ marginBottom: 16 }}>
        <input className="search" placeholder="Cerca prodotti da confrontare" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
        <div className="panel" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="panel-header"><h3>Main</h3><span className="muted">Prodotto da mantenere</span></div>
          <MergeSelectedSummary entity={selected} />
          <div className="product-list" style={{ marginBottom: 14, maxHeight: "52vh", overflowY: "auto", flex: 1 }}>
            {filteredProducts.map((product) => (
              <ProductCard key={`merge-main-${product.id}`} product={product} active={selected?.id === product.id} onClick={() => void loadDetail(product.id)} />
            ))}
          </div>
        </div>
        <div className="panel" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="panel-header"><h3>Da mergiare</h3><span className="muted">Prodotto che verrà eliminato</span></div>
          <MergeSelectedSummary entity={mergeCandidateDetail} />
          <div className="product-list" style={{ marginBottom: 14, maxHeight: "52vh", overflowY: "auto", flex: 1 }}>
            {filteredProducts.filter((p) => p.id !== selected?.id).map((product) => (
              <ProductCard key={`merge-source-${product.id}`} product={product} active={mergeCandidateDetail?.id === product.id} onClick={() => void loadMergeCandidate(product.id)} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        <div className="editing-panel">
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Campi da salvare sul prodotto principale</h4>
          <div style={{ display: "grid", gap: 12 }}>
            {([["title", "Titolo"], ["description", "Descrizione"], ["brand", "Brand"], ["origin_type", "Origine"]] as Array<[string, string]>).map(([field, label]) => (
              <MergeFieldRow key={field} field={field} label={label} selected={selected} mergeCandidateDetail={mergeCandidateDetail} mergeDraft={mergeDraft} setMergeDraft={setMergeDraft} />
            ))}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ minWidth: 110, ...labelStyle }}>Archiviato</span>
                <button className={`button tiny ${mergeDraft.archived ? "primary" : "secondary"}`} onClick={() => setMergeDraft((c: any) => ({ ...c, archived: !c.archived }))}>{mergeDraft.archived ? "Sì" : "No"}</button>
                <button className="button tiny" onClick={() => setMergeDraft((c: any) => ({ ...c, archived: selected?.archived ?? false }))}>Sinistra</button>
                <button className="button tiny" onClick={() => setMergeDraft((c: any) => ({ ...c, archived: mergeCandidateDetail?.archived ?? false }))}>Destra</button>
              </div>
            </div>
          </div>
        </div>
        <div className="editing-panel">
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Immagini, prezzi e link da importare dalla destra</h4>
          <MergeImportPanel {...props} />
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="button secondary" onClick={() => setView("dashboard")}>Annulla</button>
        <button className="button primary" onClick={() => void commitMerge()} disabled={!selected || !mergeCandidateDetail}>Salva merge</button>
      </div>
    </section>
  );
}
