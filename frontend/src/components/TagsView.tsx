import React from "react";

type TagKind = "taxonomy" | "store" | "project";

type Tag = {
  id: number;
  name: string;
  kind: TagKind;
};

type ProductSummary = {
  id: number;
  title: string;
  description: string;
  origin_type?: string | null;
  scraped_at?: string | null;
  created_at?: string | null;
  images_count: number;
  prices_count: number;
  bundles_count?: number;
  cover_image_url?: string | null;
  latest_price?: number | null;
  latest_currency?: string | null;
};

type TagStats = {
  tags: Array<Tag & { count: number }>;
  untagged_count: number;
} | null;

type Props = {
  error: string | null;
  statsProducts: number;
  tagsStats: TagStats;
  selectedTagId: number | "" | "untagged";
  setSelectedTagId: React.Dispatch<
    React.SetStateAction<number | "" | "untagged">
  >;
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
};

export default function TagsView({
  error,
  statsProducts,
  tagsStats,
  selectedTagId,
  setSelectedTagId,
  selectedSourceSite,
  setSelectedSourceSite,
  query,
  setQuery,
  TAG_KIND_ORDER,
  TAG_KIND_LABELS,
  tagsByKind,
  excludeTagsExpanded,
  setExcludeTagsExpanded,
  excludeTagIds,
  toggleExcludeTag,
  clearExcludeTags,
  tagMap,
  filteredProducts,
  selected,
  loadDetail,
  loadingList,
  formatDate,
  formatMoney,
  onBack,
  onRefresh,
}: Props) {
  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <h2>Tags</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button secondary" onClick={onBack}>
            Indietro
          </button>
          <button className="button" onClick={onRefresh}>
            Aggiorna
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#cbd5e1",
                  textTransform: "uppercase",
                }}
              >
                Seleziona un tag
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                La selezione filtra la lista prodotti qui sotto e apre il dettaglio come nella homepage.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className={`button ${selectedTagId === "" ? "primary" : "secondary"}`}
                onClick={() => {
                  setSelectedTagId("");
                  setSelectedSourceSite("");
                }}
              >
                Tutti i tag ({statsProducts})
              </button>
              <button
                className={`button ${selectedTagId === "untagged" ? "primary" : "secondary"}`}
                onClick={() => {
                  setSelectedTagId("untagged");
                  setSelectedSourceSite("");
                }}
              >
                Senza tag ({tagsStats?.untagged_count ?? 0})
              </button>
            </div>
          </div>

          {TAG_KIND_ORDER.map((kind) => {
            const group = (tagsStats?.tags || [])
              .filter((t) => t.kind === kind)
              .sort((a, b) => a.name.localeCompare(b.name));
            if (group.length === 0) return null;
            return (
              <div key={kind} style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "#4a5568",
                  }}
                >
                  {TAG_KIND_LABELS[kind]}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {group.map((tag) => {
                    const isSelected = selectedTagId === tag.id;
                    return (
                      <button
                        key={tag.id}
                        className={`tag-option ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedTagId(tag.id);
                          setSelectedSourceSite("");
                        }}
                        style={{ textAlign: "left" }}
                      >
                        <div style={{ display: "grid", gap: 4, width: "100%" }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {tag.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            {tag.count} prodotti
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <input
            className="search"
            placeholder="Cerca nel filtro attivo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="input"
            value={selectedTagId}
            onChange={(event) => {
              setSelectedTagId(
                event.target.value === "untagged"
                  ? "untagged"
                  : event.target.value
                    ? Number(event.target.value)
                    : "",
              );
              setSelectedSourceSite("");
            }}
          >
            <option value="">Tutti i tag</option>
            <option value="untagged">Senza tag</option>
            {TAG_KIND_ORDER.map((kind) =>
              tagsByKind[kind].length > 0 ? (
                <optgroup key={kind} label={`${TAG_KIND_LABELS[kind]}:`}>
                  {tagsByKind[kind].map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
          <div
            style={{
              marginTop: 4,
              padding: excludeTagsExpanded ? 12 : "10px 12px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              display: "grid",
              gap: excludeTagsExpanded ? 10 : 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                cursor: "pointer",
              }}
              onClick={() => setExcludeTagsExpanded((current) => !current)}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#cbd5e1",
                      textTransform: "uppercase",
                    }}
                  >
                    Escludi tag
                  </div>
                  {excludeTagIds.length > 0 && (
                    <span
                      className="badge muted"
                      style={{ padding: "4px 10px", fontSize: 11 }}
                    >
                      {excludeTagIds.length}
                    </span>
                  )}
                </div>
                {excludeTagsExpanded && (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                    Seleziona uno o più tag da togliere dai risultati.
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {excludeTagsExpanded && (
                  <button
                    className="button secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearExcludeTags();
                    }}
                    disabled={excludeTagIds.length === 0}
                    style={{ padding: "8px 12px" }}
                  >
                    Azzera
                  </button>
                )}
                <span style={{ color: "#94a3b8", fontSize: 14 }}>
                  {excludeTagsExpanded ? "▴" : "▾"}
                </span>
              </div>
            </div>

            {excludeTagsExpanded && (
              <>
                {excludeTagIds.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {excludeTagIds.map((tagId) => {
                      const tag = tagMap.get(tagId);
                      if (!tag) return null;
                      return (
                        <div key={`exclude-chip-${tagId}`} className="tag-pill">
                          <span style={{ fontSize: 14, fontWeight: 500 }}>
                            {tag.name}
                          </span>
                          <button
                            className="button tiny danger"
                            onClick={() => toggleExcludeTag(tagId)}
                            style={{ padding: "0px 6px", fontSize: 12 }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    maxHeight: "260px",
                    overflowY: "auto",
                    paddingRight: 6,
                  }}
                >
                  {TAG_KIND_ORDER.map((kind) => {
                    const group = tagsByKind[kind]
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name));
                    if (group.length === 0) return null;
                    return (
                      <div key={`exclude-${kind}`} style={{ display: "grid", gap: 6 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: "#4a5568",
                          }}
                        >
                          {TAG_KIND_LABELS[kind]}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                            gap: 8,
                          }}
                        >
                          {group.map((tag) => {
                            const isSelected = excludeTagIds.includes(tag.id);
                            return (
                              <label
                                key={`exclude-tag-${tag.id}`}
                                className={`tag-option ${isSelected ? "selected" : ""}`}
                                style={{ cursor: "pointer" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleExcludeTag(tag.id)}
                                  style={{ marginTop: 2 }}
                                />
                                <div style={{ fontSize: 13, lineHeight: 1.3 }}>
                                  <div style={{ fontWeight: 600 }}>
                                    {tag.name}
                                  </div>
                                </div>
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
        </div>

        {selectedSourceSite && (
          <div className="badge muted" style={{ marginBottom: 10 }}>
            Filtro sito: {selectedSourceSite}
          </div>
        )}

        <div className="product-list">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              className={`product-card ${selected?.id === product.id ? "active" : ""}`}
              onClick={() => loadDetail(product.id)}
            >
              <div className="product-card-media">
                {product.cover_image_url ? (
                  <img src={product.cover_image_url} alt={product.title} />
                ) : (
                  <div className="placeholder">No image</div>
                )}
              </div>
              <div className="product-card-body">
                <div className="product-card-topline">
                  <span>{product.origin_type || "unknown"}</span>
                  <span>{formatDate(product.scraped_at || product.created_at)}</span>
                </div>
                <h3>{product.title}</h3>
                <p>{product.description}</p>
                <div className="product-card-meta">
                  <span>{product.images_count} img</span>
                  <span>{product.prices_count} prezzi</span>
                  <span>{product.bundles_count || 0} bundle</span>
                  <span>
                    {formatMoney(product.latest_price, product.latest_currency)}
                  </span>
                </div>
              </div>
            </button>
          ))}

          {!loadingList && filteredProducts.length === 0 && (
            <div className="empty-state">Nessun prodotto trovato.</div>
          )}
        </div>
      </div>
    </section>
  );
}