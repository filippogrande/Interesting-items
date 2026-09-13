import { SourceWebsite } from "../types";

type SourcesViewProps = {
  sourceWebsitesStats: { websites: SourceWebsite[] } | null;
  totalProducts: number;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onSelectAll: () => void;
  onSelectSite: (siteName: string) => void;
};

export function SourcesView({
  sourceWebsitesStats,
  totalProducts,
  error,
  onBack,
  onRefresh,
  onSelectAll,
  onSelectSite,
}: SourcesViewProps) {
  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <h2>Source websites</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button secondary" onClick={onBack}>
            Indietro
          </button>
          <button className="button" onClick={onRefresh}>
            Aggiorna
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div style={{ display: "grid", gap: 8 }}>
        <button className="button" onClick={onSelectAll}>
          Tutti i siti ({totalProducts})
        </button>
        {(sourceWebsitesStats?.websites || []).map((site) => (
          <button
            key={site.name}
            className="button"
            onClick={() => onSelectSite(site.name)}
          >
            {site.name} ({site.count})
          </button>
        ))}
      </div>
    </section>
  );
}
