import React from "react";
import ProductCard from "./ProductCard";
import { formatMoney, derivePlatformLabel } from "../utils/format";

const labelStyle = { fontSize: 12, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700, marginBottom: 8 } as const;

const scalarFields: Array<{ field: "title" | "description" | "brand" | "origin_type"; label: string }> = [
  { field: "title", label: "Titolo" },
  { field: "description", label: "Descrizione" },
  { field: "brand", label: "Brand" },
  { field: "origin_type", label: "Origine" },
];

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
  mergePhase: "chooser" | "editor";
  openMergeEditor: (main: any, candidate: any) => void;
  goBackToChooser: () => void;
  commitMerge: (selectedId: number) => Promise<any>;
  mergeDraft: any;
  setMergeDraft: (updater: (current: any) => any) => void;
  keepImageIds: number[];
  setKeepImageIds: (updater: (current: number[]) => number[]) => void;
  keepPriceIds: number[];
  setKeepPriceIds: (updater: (current: number[]) => number[]) => void;
  keepSourceUrlIds: number[];
  setKeepSourceUrlIds: (updater: (current: number[]) => number[]) => void;
  mergeTagIds: number[];
  setMergeTagIds: (updater: (current: number[]) => number[]) => void;
};

function MergePinnedCard({ entity, label }: { entity: any; label: string }) {
  if (!entity) {
    return (
      <div style={{
        padding: "12px",
        background: "var(--bg, #0f1115)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div className="empty-state">Seleziona il prodotto {label}.</div>
      </div>
    );
  }
  return (
    <div style={{
      padding: "12px",
      background: "var(--bg, #0f1115)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}>
      <ProductCard product={entity} active={true} onClick={() => {}} />
    </div>
  );
}

function ToggleKeep({
  id,
  keepIds,
  setKeepIds,
}: {
  id: number;
  keepIds: number[];
  setKeepIds: (updater: (current: number[]) => number[]) => void;
}) {
  const kept = keepIds.includes(id);
  return (
    <button
      className={`button tiny ${kept ? "danger" : ""}`}
      style={{ position: "absolute", top: 8, right: 8, zIndex: 2, padding: "2px 8px", lineHeight: 1 }}
      onClick={() =>
        setKeepIds((c) =>
          kept ? c.filter((x) => x !== id) : [...c, id],
        )
      }
      aria-label={kept ? "Rimuovi dal merge" : "Ripristina nel merge"}
      title={kept ? "Rimuovi dal merge" : "Ripristina nel merge"}
    >
      {kept ? "×" : "↺"}
    </button>
  );
}

// Vista selezione: due colonne con scroll interno e card pinnata in alto.
// Ogni colonna seleziona in modo INDIPENDENTE (la destra carica via API senza
// toccare 'selected') e non può contenere il prodotto selezionato sull'altra.
function MergeChooser({
  filteredProducts,
  selected,
  mergeCandidateDetail,
  query,
  setQuery,
  loadDetail,
  loadMergeCandidate,
}: {
  filteredProducts: any[];
  selected: any | null;
  mergeCandidateDetail: any | null;
  query: string;
  setQuery: (value: string) => void;
  loadDetail: (id: number) => void;
  loadMergeCandidate: (id: number) => void;
}) {
  const mainList = filteredProducts.filter((p) => p.id !== mergeCandidateDetail?.id);
  const candidateList = filteredProducts.filter((p) => p.id !== selected?.id);
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <input className="search" placeholder="Cerca prodotti da confrontare" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
        <div className="panel" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="panel-header"><h3>Main</h3><span className="muted">Prodotto da mantenere</span></div>
          <div className="product-list" style={{ marginBottom: 0, maxHeight: "calc(100vh - 220px)", overflowY: "auto", flex: 1 }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <MergePinnedCard entity={selected} label="principale" />
            </div>
            {mainList.map((product) => (
              <ProductCard key={`merge-main-${product.id}`} product={product} active={selected?.id === product.id} onClick={() => void loadDetail(product.id)} />
            ))}
          </div>
        </div>
        <div className="panel" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="panel-header"><h3>Da mergiare</h3><span className="muted">Prodotto che verrà eliminato</span></div>
          <div className="product-list" style={{ marginBottom: 0, maxHeight: "calc(100vh - 220px)", overflowY: "auto", flex: 1 }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <MergePinnedCard entity={mergeCandidateDetail} label="da mergiare" />
            </div>
            {candidateList.map((product) => (
              <ProductCard key={`merge-source-${product.id}`} product={product} active={mergeCandidateDetail?.id === product.id} onClick={() => void loadMergeCandidate(product.id)} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// Crea le coppie prezzo+link di un prodotto: prices[i] è legato a source_urls[i]
// (stesso indice, come nella modalità modifica).
function buildPairs(product: any) {
  const prices = product?.prices || [];
  const sources = product?.source_urls || [];
  const len = Math.max(prices.length, sources.length);
  const pairs: Array<{ price: any | null; source: any | null }> = [];
  for (let i = 0; i < len; i++) {
    pairs.push({ price: prices[i] || null, source: sources[i] || null });
  }
  return pairs;
}

// Riga per un campo singolo: valore sinistra | bottoni centrali | valore destra,
// + campo modificabile con il valore scelto. Testo sempre bianco.
function MergeFieldRow({ field, label, left, right, draft, setDraft }: any) {
  const leftVal = left ? left[field] ?? "" : "";
  const rightVal = right ? right[field] ?? "" : "";
  const currentVal = draft[field] ?? "";
  const pick = (v: any) => setDraft((c: any) => ({ ...c, [field]: v ?? "" }));
  const isFromLeft = String(currentVal) === String(leftVal) && leftVal !== "";
  const isFromRight = String(currentVal) === String(rightVal) && rightVal !== "";
  const showText = (v: any) => (v === "" || v == null ? "—" : String(v));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 1fr", gap: 8, alignItems: "center" }}>
        <button
          className={`tag-option ${isFromLeft ? "selected" : ""}`}
          style={{ textAlign: "left", alignItems: "center", gap: 6, color: "#fff" }}
          onClick={() => pick(leftVal)}
          title="Usa il valore a sinistra"
        >
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{showText(leftVal)}</span>
        </button>
        <div style={{ display: "grid", gap: 6 }}>
          <button className={`button tiny ${isFromLeft ? "primary" : "secondary"}`} onClick={() => pick(leftVal)} title="Sinistra">←</button>
          <button className={`button tiny ${isFromRight ? "primary" : "secondary"}`} onClick={() => pick(rightVal)} title="Destra">→</button>
        </div>
        <button
          className={`tag-option ${isFromRight ? "selected" : ""}`}
          style={{ textAlign: "left", alignItems: "center", gap: 6, color: "#fff" }}
          onClick={() => pick(rightVal)}
          title="Usa il valore a destra"
        >
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{showText(rightVal)}</span>
        </button>
      </div>
      {field === "description" ? (
        <textarea className="textarea" value={currentVal} onChange={(e) => pick(e.target.value)} />
      ) : (
        <input className="input" value={currentVal} onChange={(e) => pick(e.target.value)} />
      )}
    </div>
  );
}

// Vista confronto: due metà sempre. Campi singoli affiancati con bottoni centrali;
// immagini/tag unione con X; prezzi+link come coppie legate (X rimuove entrambi).
function MergeEditor({
  selected,
  mergeCandidateDetail,
  mergeDraft,
  setMergeDraft,
  keepImageIds,
  setKeepImageIds,
  keepPriceIds,
  setKeepPriceIds,
  keepSourceUrlIds,
  setKeepSourceUrlIds,
  mergeTagIds,
  setMergeTagIds,
  goBackToChooser,
  commitMerge,
  error,
}: any) {
  const dedup = <T extends { id: number }>(arr: T[]): T[] => {
    const seen = new Set<number>();
    return arr.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  };
  const unionImages = dedup([...(selected?.images || []), ...(mergeCandidateDetail?.images || [])]);
  const unionTags = dedup([...(selected?.tags || []), ...(mergeCandidateDetail?.tags || [])]);
  // Coppie prezzo+link: union dei due prodotti, dedup per id del prezzo.
  const mainPairs = buildPairs(selected);
  const candidatePairs = buildPairs(mergeCandidateDetail);
  const allPairs = [...mainPairs, ...candidatePairs];
  const seenPairs = new Set<number>();
  const unionPairs = allPairs.filter((pair) => {
    const key = pair.price ? pair.price.id : pair.source ? pair.source.id : 0;
    if (key === 0 || seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });

  const pairKept = (pair: { price: any | null; source: any | null }) => {
    const priceOk = pair.price ? keepPriceIds.includes(pair.price.id) : true;
    const sourceOk = pair.source ? keepSourceUrlIds.includes(pair.source.id) : true;
    return priceOk && sourceOk;
  };
  const togglePair = (pair: { price: any | null; source: any | null }) => {
    const kept = pairKept(pair);
    if (pair.price) {
      setKeepPriceIds((c: number[]) =>
        kept ? c.filter((x) => x !== pair.price!.id) : [...c, pair.price!.id],
      );
    }
    if (pair.source) {
      setKeepSourceUrlIds((c: number[]) =>
        kept ? c.filter((x) => x !== pair.source!.id) : [...c, pair.source!.id],
      );
    }
  };

  const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 };

  return (
    <>
      <div className="panel-header">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="button secondary" onClick={goBackToChooser} title="Torna alla selezione (le modifiche vengono mantenute)">← Indietro</button>
          <h2 style={{ margin: 0 }}>Confronta i prodotti</h2>
        </div>
        <button className="button primary" onClick={() => void commitMerge(selected?.id)} disabled={!selected || !mergeCandidateDetail}>Salva merge</button>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div style={rowStyle}>
        {/* Colonna sinistra = prodotto MAIN */}
        <div className="panel" style={{ minHeight: 0, padding: 16 }}>
          <div className="panel-header"><h3>Main</h3><span className="muted">Sinistra</span></div>
          <div style={{ display: "grid", gap: 12 }}>
            {scalarFields.map(({ field, label }) => (
              <div key={field} style={{ display: "grid", gap: 4 }}>
                <div style={labelStyle}>{label}</div>
                <button
                  className={`tag-option ${String(mergeDraft[field]) === String(selected?.[field]) && selected?.[field] ? "selected" : ""}`}
                  style={{ textAlign: "left", alignItems: "center", gap: 6, color: "#fff" }}
                  onClick={() => setMergeDraft((c: any) => ({ ...c, [field]: selected?.[field] ?? "" }))}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.[field] || "—"}</span>
                </button>
              </div>
            ))}
            <div style={{ display: "grid", gap: 4 }}>
              <div style={labelStyle}>Archiviato</div>
              <button
                className={`tag-option ${mergeDraft.archived === selected?.archived ? "selected" : ""}`}
                style={{ textAlign: "left", alignItems: "center", gap: 6, color: "#fff" }}
                onClick={() => setMergeDraft((c: any) => ({ ...c, archived: !!selected?.archived }))}
              >
                {selected?.archived ? "Sì" : "No"}
              </button>
            </div>
          </div>
        </div>

        {/* Colonna destra = prodotto DA MERGIARE */}
        <div className="panel" style={{ minHeight: 0, padding: 16 }}>
          <div className="panel-header"><h3>Da mergiare</h3><span className="muted">Destra</span></div>
          <div style={{ display: "grid", gap: 12 }}>
            {scalarFields.map(({ field, label }) => (
              <div key={field} style={{ display: "grid", gap: 4 }}>
                <div style={labelStyle}>{label}</div>
                <button
                  className={`tag-option ${String(mergeDraft[field]) === String(mergeCandidateDetail?.[field]) && mergeCandidateDetail?.[field] ? "selected" : ""}`}
                  style={{ textAlign: "left", alignItems: "center", gap: 6, color: "#fff" }}
                  onClick={() => setMergeDraft((c: any) => ({ ...c, [field]: mergeCandidateDetail?.[field] ?? "" }))}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mergeCandidateDetail?.[field] || "—"}</span>
                </button>
              </div>
            ))}
            <div style={{ display: "grid", gap: 4 }}>
              <div style={labelStyle}>Archiviato</div>
              <button
                className={`tag-option ${mergeDraft.archived === mergeCandidateDetail?.archived ? "selected" : ""}`}
                style={{ textAlign: "left", alignItems: "center", gap: 6, color: "#fff" }}
                onClick={() => setMergeDraft((c: any) => ({ ...c, archived: !!mergeCandidateDetail?.archived }))}
              >
                {mergeCandidateDetail?.archived ? "Sì" : "No"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Campo modificabile per il valore scelto */}
      <div className="editing-panel">
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Valori finali — modifica se vuoi</h4>
        <div style={{ display: "grid", gap: 12 }}>
          {scalarFields.map(({ field, label }) => (
            <div key={field} style={{ display: "grid", gap: 4 }}>
              <div style={labelStyle}>{label}</div>
              {field === "description" ? (
                <textarea className="textarea" value={mergeDraft[field]} onChange={(e) => setMergeDraft((c: any) => ({ ...c, [field]: e.target.value }))} />
              ) : (
                <input className="input" value={mergeDraft[field]} onChange={(e) => setMergeDraft((c: any) => ({ ...c, [field]: e.target.value }))} />
              )}
            </div>
          ))}
          <div style={{ display: "grid", gap: 4 }}>
            <div style={labelStyle}>Archiviato</div>
            <button className={`button tiny ${mergeDraft.archived ? "primary" : "secondary"}`} onClick={() => setMergeDraft((c: any) => ({ ...c, archived: !c.archived }))}>{mergeDraft.archived ? "Sì" : "No"}</button>
          </div>
        </div>
      </div>

      <div className="editing-panel">
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Immagini — unione dei due, togli con la X</h4>
        <div className="gallery" style={{ margin: 0 }}>
          {unionImages.map((image) => (
            <div key={`img-${image.id}`} className="gallery-item" style={{ position: "relative", opacity: keepImageIds.includes(image.id) ? 1 : 0.4 }}>
              <ToggleKeep id={image.id} keepIds={keepImageIds} setKeepIds={setKeepImageIds} />
              {image.url ? <img src={image.url} alt="" /> : <div className="placeholder">No image</div>}
            </div>
          ))}
          {unionImages.length === 0 && <div className="empty-state">Nessuna immagine.</div>}
        </div>
      </div>

      <div className="editing-panel">
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Prezzi e link — coppie legate, togli con la X</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {unionPairs.map((pair) => {
            const kept = pairKept(pair);
            return (
              <div key={`pair-${pair.price?.id ?? pair.source?.id}`} className="tag-option" style={{ position: "relative", opacity: kept ? 1 : 0.4 }}>
                <button
                  className={`button tiny ${kept ? "danger" : ""}`}
                  style={{ position: "absolute", top: 8, right: 8, zIndex: 2, padding: "2px 8px", lineHeight: 1 }}
                  onClick={() => togglePair(pair)}
                  title={kept ? "Rimuovi dal merge" : "Ripristina nel merge"}
                >
                  {kept ? "×" : "↺"}
                </button>
                <div style={{ display: "grid", gap: 4, paddingRight: 18 }}>
                  {pair.price ? (
                    <strong>{formatMoney(pair.price.amount, pair.price.currency)}</strong>
                  ) : (
                    <em>—</em>
                  )}
                  {pair.source ? (
                    <a href={pair.source.url} target="_blank" rel="noreferrer">{derivePlatformLabel(pair.price, pair.source)}</a>
                  ) : (
                    <span className="muted">nessun link</span>
                  )}
                </div>
              </div>
            );
          })}
          {unionPairs.length === 0 && <div className="empty-state">Nessun prezzo o link.</div>}
        </div>
      </div>

      <div className="editing-panel">
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Tag — unione dei due, togli con la X</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {unionTags.map((tag) => (
            <div key={`tag-${tag.id}`} className="tag-pill" style={{ position: "relative", opacity: mergeTagIds.includes(tag.id) ? 1 : 0.4, paddingRight: 26 }}>
              <ToggleKeep id={tag.id} keepIds={mergeTagIds} setKeepIds={setMergeTagIds} />
              <span>{tag.name}</span>
            </div>
          ))}
          {unionTags.length === 0 && <div className="empty-state">Nessun tag.</div>}
        </div>
      </div>
    </>
  );
}

export default function MergeView(props: MergeViewProps) {
  const {
    filteredProducts, selected, mergeCandidateDetail, query, setQuery, error, setView,
    loadDetail, loadMergeCandidate, mergePhase, openMergeEditor, goBackToChooser, commitMerge,
    mergeDraft, setMergeDraft, keepImageIds, setKeepImageIds, keepPriceIds, setKeepPriceIds,
    keepSourceUrlIds, setKeepSourceUrlIds, mergeTagIds, setMergeTagIds,
  } = props;

  return (
    <section className="panel list-panel" style={{ gridColumn: "1 / -1" }}>
      <div className="panel-header">
        <h2>Unisci i prodotti</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button secondary" onClick={() => setView("dashboard")}>Indietro</button>
          {mergePhase === "chooser" && (
            <button className="button primary" onClick={() => openMergeEditor(selected, mergeCandidateDetail)} disabled={!selected || !mergeCandidateDetail}>Prosegui</button>
          )}
        </div>
      </div>
      {error && mergePhase === "chooser" && <div className="error-box">{error}</div>}
      {mergePhase === "chooser" ? (
        <MergeChooser
          filteredProducts={filteredProducts}
          selected={selected}
          mergeCandidateDetail={mergeCandidateDetail}
          query={query}
          setQuery={setQuery}
          loadDetail={loadDetail}
          loadMergeCandidate={loadMergeCandidate}
        />
      ) : (
        <MergeEditor
          selected={selected}
          mergeCandidateDetail={mergeCandidateDetail}
          mergeDraft={mergeDraft}
          setMergeDraft={setMergeDraft}
          keepImageIds={keepImageIds}
          setKeepImageIds={setKeepImageIds}
          keepPriceIds={keepPriceIds}
          setKeepPriceIds={setKeepPriceIds}
          keepSourceUrlIds={keepSourceUrlIds}
          setKeepSourceUrlIds={setKeepSourceUrlIds}
          mergeTagIds={mergeTagIds}
          setMergeTagIds={setMergeTagIds}
          goBackToChooser={goBackToChooser}
          commitMerge={commitMerge}
          error={error}
        />
      )}
    </section>
  );
}
