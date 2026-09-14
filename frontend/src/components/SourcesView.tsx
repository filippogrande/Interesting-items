import React from "react";
import ProductCard from "./ProductCard";
import ProductDetailPanel from "./ProductDetailPanel";

type ProductSummary = {
  id: number; title: string; description: string; origin_type?: string | null;
  scraped_at?: string | null; created_at?: string | null; images_count: number;
  prices_count: number; bundles_count?: number; cover_image_url?: string | null;
  latest_price?: number | null; latest_currency?: string | null;
};

type SourcesViewProps = {
  sourceWebsitesStats: { websites: any[] } | null;
  totalProducts: number;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onSelectAll: () => void;
  onSelectSite: (siteName: string) => void;
  selectedSourceSite: string;
  filteredProducts: ProductSummary[];
  selected: { id: number } | null;
  loadDetail: (productId: number) => void;
  loadingList: boolean;
  formatDate: (value?: string | null) => string;
  formatMoney: (amount?: number | null, currency?: string | null) => string;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  detailPanel: Record<string, any>;
};

export function SourcesView({
  sourceWebsitesStats, totalProducts, error, onBack, onRefresh,
  onSelectAll, onSelectSite, selectedSourceSite, filteredProducts, selected,
  loadDetail, loadingList, formatDate, formatMoney, query, setQuery, detailPanel,
}: SourcesViewProps) {
  return (
    <div className="layout">
      <section className="panel list-panel">
        <div className="panel-header">
          <h2>Source websites</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button secondary" onClick={onBack}>Indietro</button>
            <button className="button" onClick={onRefresh}>Aggiorna</button>
          </div>
        </div>
        {error && <div className="error-box">{error}</div>}

        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <button
            className={`button ${!selectedSourceSite ? "primary" : "secondary"}`}
            onClick={onSelectAll}
          >
            Tutti i siti ({totalProducts})
          </button>
          {(sourceWebsitesStats?.websites || []).map((site) => (
            <button
              key={site.name}
              className={`button ${selectedSourceSite === site.name ? "primary" : "secondary"}`}
              onClick={() => onSelectSite(site.name)}
            >
              {site.name} ({site.count})
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <input className="search search-full" placeholder="Cerca prodotti..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
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
