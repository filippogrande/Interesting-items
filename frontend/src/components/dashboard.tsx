import React from "react";

export function AppHeader({
  loading,
  onRefresh,
}: {
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="hero">
      <div>
        <div className="badge">Database Dashboard</div>
        <h1>Prodotti salvati nel DB</h1>
        <p>
          Visualizzazione dei dati estratti da Vinted, AliExpress e gli altri
          canali supportati.
        </p>
      </div>
      <div className="hero-actions">
        <button className="button secondary" onClick={onRefresh}>
          Aggiorna
        </button>
        <span className="status-pill">{loading ? "Caricamento..." : "Online"}</span>
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      style={onClick ? { cursor: "pointer" } : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                onClick();
              }
            }
          : undefined
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function CreationModal({
  open,
  draft,
  onClose,
  onChange,
  onCreate,
}: {
  open: boolean;
  draft: {
    title?: string;
    description?: string;
    brand?: string;
    origin_type?: string;
  };
  onClose: () => void;
  onChange: (patch: {
    title?: string;
    description?: string;
    brand?: string;
    origin_type?: string;
  }) => void;
  onCreate: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Nuovo prodotto</h3>
        <label>Title</label>
        <input
          className="input"
          value={draft.title || ""}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <label>Description</label>
        <textarea
          className="textarea"
          value={draft.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <label>Brand</label>
        <input
          className="input"
          value={draft.brand || ""}
          onChange={(e) => onChange({ brand: e.target.value })}
        />
        <label>Origin type</label>
        <input
          className="input"
          value={draft.origin_type || ""}
          onChange={(e) => onChange({ origin_type: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="button primary" onClick={onCreate}>
            Crea
          </button>
          <button className="button secondary" onClick={onClose}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
