import React from "react";

export default function ProductList(props: any) {
  const {
    filteredProducts,
    selected,
    loadingList,
    query,
    setQuery,
    creating,
    setCreating,
    selectedTagId,
    setSelectedTagId,
    TAG_KIND_ORDER,
    tagsByKind,
    excludeTagsExpanded,
    setExcludeTagsExpanded,
    excludeTagIds,
    clearExcludeTags,
    tagMap,
    loadDetail,
    formatDate,
    formatMoney,
    products,
  } = props;

  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <h2>Elenco prodotti</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="button secondary"
              onClick={() => setCreating(true)}
            >
              + Nuovo prodotto
            </button>
          </div>
          <input
            className="search"
            placeholder="Cerca per titolo, descrizione o origine"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="input"
            value={selectedTagId}
            onChange={(event) => {
              setSelectedTagId(event.target.value ? Number(event.target.value) : "");
            }}
          >
            <option value="">Tutti i tag</option>
            {TAG_KIND_ORDER.map((kind: any) =>
              tagsByKind[kind].length > 0 ? (
                <optgroup key={kind} label={`${kind}:`}>
                  {tagsByKind[kind].map((tag: any) => (
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
              onClick={() => setExcludeTagsExpanded((current: boolean) => !current)}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase" }}>
                    Escludi tag
                  </div>
                  {excludeTagIds.length > 0 && (
                    <span className="badge muted" style={{ padding: "4px 10px", fontSize: 11 }}>
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
                    style={{ padding: "8px 12px" }}
                  >
                    Azzera
                  </button>
                )}
                <span style={{ color: "#94a3b8", fontSize: 14 }}>{excludeTagsExpanded ? "▴" : "▾"}</span>
              </div>
            </div>

            {excludeTagsExpanded && (
              <>
                {excludeTagIds.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {excludeTagIds.map((tagId: number) => {
                      const tag = tagMap.get(tagId);
                      if (!tag) return null;
                      return (
                        <div key={`exclude-chip-${tagId}`} className="tag-pill">
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{tag.name}</span>
                          <button className="button tiny danger" onClick={() => props.toggleExcludeTag(tagId)} style={{ padding: "0px 6px", fontSize: 12 }}>
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: "grid", gap: 8, maxHeight: "260px", overflowY: "auto", paddingRight: 6 }}>
                  {TAG_KIND_ORDER.map((kind: any) => {
                    const group = tagsByKind[kind].slice().sort((a: any, b: any) => a.name.localeCompare(b.name));
                    if (group.length === 0) return null;
                    return (
                      <div key={`exclude-${kind}`} style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#4a5568" }}>{kind}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                          {group.map((tag: any) => {
                            const isSelected = excludeTagIds.includes(tag.id);
                            return (
                              <label key={`exclude-tag-${tag.id}`} className={`tag-option ${isSelected ? "selected" : ""}`} style={{ cursor: "pointer" }}>
                                <input type="checkbox" checked={isSelected} onChange={() => props.toggleExcludeTag(tag.id)} style={{ marginTop: 2 }} />
                                <div style={{ fontSize: 13, lineHeight: 1.3 }}>
                                  <div style={{ fontWeight: 600 }}>{tag.name}</div>
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
      </div>

      {props.error && <div className="error-box">{props.error}</div>}

      {props.selectedSourceSite && <div className="badge muted" style={{ marginBottom: 10 }}>Filtro sito: {props.selectedSourceSite}</div>}

      <div className="product-list">
        {filteredProducts.map((product: any) => (
          <button key={product.id} className={`product-card ${selected?.id === product.id ? "active" : ""}`} onClick={() => void loadDetail(product.id)}>
            <div className="product-card-media">
              {product.cover_image_url ? <img src={product.cover_image_url} alt={product.title} /> : <div className="placeholder">No image</div>}
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
                <span>{formatMoney(product.latest_price, product.latest_currency)}</span>
              </div>
            </div>
          </button>
        ))}

        {!loadingList && filteredProducts.length === 0 && <div className="empty-state">Nessun prodotto trovato.</div>}
      </div>
    </section>
  );
}
