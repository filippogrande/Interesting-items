import React from "react";
import ProductCard from "./ProductCard";
import ProductDetailPanel from "./ProductDetailPanel";

type TagKind = "taxonomy" | "store" | "project";

type Tag = { id: number; name: string; kind: TagKind };
type TagStats = { tags: Array<Tag & { count: number }>; untagged_count: number } | null;
type ProductSummary = {
  id: number; title: string; description: string; origin_type?: string | null;
  scraped_at?: string | null; created_at?: string | null; images_count: number;
  prices_count: number; bundles_count?: number; cover_image_url?: string | null;
  latest_price?: number | null; latest_currency?: string | null;
};

type Props = {
  error: string | null;
  statsProducts: number;
  tagsStats: TagStats;
  selectedTagId: number | "" | "untagged";
  setSelectedTagId: React.Dispatch<React.SetStateAction<number | "" | "untagged">>;
  selectedSourceSite: string;
  setSelectedSourceSite: React.Dispatch<React.SetStateAction<string>>;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  TAG_KIND_ORDER: TagKind[];
  TAG_KIND_LABELS: Record<TagKind, string>;
  tagsByKind: Record<TagKind, Tag[]>;
  excludeTagsExpanded: boolean;
  setExcludeTagsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  excludeTagIds: number[];
  toggleExcludeTag: (tagId: number) => void;
  clearExcludeTags: () => void;
  tagMap: Map<number, Tag>;
  filteredProducts: ProductSummary[];
  selected: { id: number } | null;
  loadDetail: (productId: number) => void;
  loadingList: boolean;
  formatDate: (value?: string | null) => string;
  formatMoney: (amount?: number | null, currency?: string | null) => string;
  onBack: () => void;
  onRefresh: () => void;
  detailPanel: Record<string, any>;
};

export default function TagsView(props: Props) {
  const {
    error, statsProducts, tagsStats, selectedTagId, setSelectedTagId,
    selectedSourceSite, setSelectedSourceSite, query, setQuery,
    TAG_KIND_ORDER, TAG_KIND_LABELS, tagsByKind, excludeTagsExpanded,
    setExcludeTagsExpanded, excludeTagIds, toggleExcludeTag, clearExcludeTags,
    tagMap, filteredProducts, selected, loadDetail, loadingList,
    formatDate, formatMoney, onBack, onRefresh, detailPanel,
  } = props;

  return (
    <div className="layout">
      <section className="panel list-panel">
        <div className="panel-header">
          <h2>Tags</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button secondary" onClick={onBack}>Indietro</button>
            <button className="button" onClick={onRefresh}>Aggiorna</button>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        {/* Selezione tag: card cliccabili, testo leggibile */}
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={`button ${selectedTagId === "" ? "primary" : "secondary"}`}
              onClick={() => { setSelectedTagId(""); setSelectedSourceSite(""); }}
            >
              Tutti i tag ({statsProducts})
            </button>
            <button
              className={`button ${selectedTagId === "untagged" ? "primary" : "secondary"}`}
              onClick={() => { setSelectedTagId("untagged"); setSelectedSourceSite(""); }}
            >
              Senza tag ({tagsStats?.untagged_count ?? 0})
            </button>
          </div>

          {TAG_KIND_ORDER.map((kind) => {
            const group = (tagsStats?.tags || [])
              .filter((t) => t.kind === kind)
              .sort((a, b) => a.name.localeCompare(b.name));
            if (group.length === 0) return null;
            return (
              <div key={kind} style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#7a8ba3" }}>
                  {TAG_KIND_LABELS[kind]}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                  {group.map((tag) => {
                    const isSelected = selectedTagId === tag.id;
                    return (
                      <button
                        key={tag.id}
                        className={`tag-option ${isSelected ? "selected" : ""}`}
                        onClick={() => { setSelectedTagId(tag.id); setSelectedSourceSite(""); }}
                        style={{
                          textAlign: "left",
                          color: isSelected ? "#0f172a" : "#e2e8f0",
                          background: isSelected ? "#60a5fa" : "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4, width: "100%" }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{tag.name}</div>
                          <div style={{ fontSize: 12, color: isSelected ? "#334155" : "#94a3b8" }}>{tag.count} prodotti</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Escludi tag */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setExcludeTagsExpanded((c) => !c)}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase" }}>Escludi tag</div>
            {excludeTagIds.length > 0 && <span className="badge muted" style={{ padding: "4px 10px", fontSize: 11 }}>{excludeTagIds.length}</span>}
            <span style={{ color: "#94a3b8", fontSize: 14 }}>{excludeTagsExpanded ? "▴" : "▾"}</span>
            {excludeTagsExpanded && (
              <button className="button secondary" onClick={(e) => { e.stopPropagation(); clearExcludeTags(); }} disabled={excludeTagIds.length === 0} style={{ padding: "6px 10px", fontSize: 12 }}>Azzera</button>
            )}
          </div>
          {excludeTagsExpanded && (
            <>
              {excludeTagIds.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {excludeTagIds.map((tagId) => {
                    const tag = tagMap.get(tagId);
                    if (!tag) return null;
                    return (
                      <div key={`exclude-chip-${tagId}`} className="tag-pill">
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>{tag.name}</span>
                        <button className="button tiny danger" onClick={() => toggleExcludeTag(tagId)} style={{ padding: "0px 6px", fontSize: 12 }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "grid", gap: 8, maxHeight: "200px", overflowY: "auto", paddingRight: 6, marginTop: 8 }}>
                {TAG_KIND_ORDER.map((kind) => {
                  const group = tagsByKind[kind].slice().sort((a, b) => a.name.localeCompare(b.name));
                  if (group.length === 0) return null;
                  return (
                    <div key={`exclude-${kind}`} style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#7a8ba3" }}>{TAG_KIND_LABELS[kind]}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                        {group.map((tag) => {
                          const isSelected = excludeTagIds.includes(tag.id);
                          return (
                            <label key={`exclude-tag-${tag.id}`} className={`tag-option ${isSelected ? "selected" : ""}`} style={{ cursor: "pointer", color: "#e2e8f0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center" }}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleExcludeTag(tag.id)} />
                              <div style={{ fontSize: 13, lineHeight: 1.3 }}><div style={{ fontWeight: 600 }}>{tag.name}</div></div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Lista filtrata */}
        <input className="search search-full" placeholder="Cerca nel filtro attivo" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 12 }} />
        {selectedSourceSite && <div className="badge muted" style={{ marginBottom: 10 }}>Filtro sito: {selectedSourceSite}</div>}
        <div className="product-list">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} active={selected?.id === product.id} onClick={() => loadDetail(product.id)} />
          ))}
          {!loadingList && filteredProducts.length === 0 && <div className="empty-state">Nessun prodotto trovato.</div>}
        </div>
      </section>
      <ProductDetailPanel {...detailPanel} />
    </div>
  );
}
