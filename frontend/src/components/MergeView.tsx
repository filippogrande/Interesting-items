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
  selectedTagId: number | "" | "untagged";
  selectedSourceSite: string;
  excludeTagIds: number[];
};

export default function MergeView(props: MergeViewProps) {
  const {
    filteredProducts,
    selected,
    mergeCandidateDetail,
    query,
    setQuery,
    error,
    setView,
    loadDetail,
    loadMergeCandidate,
    commitMerge,
    mergeDraft,
    setMergeDraft,
    selectedTagId,
    selectedSourceSite,
    excludeTagIds,
  } = props;

  return (
    <section
      className="panel list-panel"
      style={{ gridColumn: "1 / -1" }}
    >
      <div className="panel-header">
        <h2>Unisci i prodotti</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="button secondary"
            onClick={() => setView("dashboard")}
          >
            Indietro
          </button>
          <button
            className="button primary"
            onClick={() => void commitMerge()}
            disabled={!selected || !mergeCandidateDetail}
          >
            Salva merge
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <input
          className="search"
          placeholder="Cerca prodotti da confrontare"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        {/* MAIN */}
        <div
          className="panel"
          style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <div className="panel-header">
            <h3>Main</h3>
            <span className="muted">Prodotto da mantenere</span>
          </div>
          {selected ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                position: "sticky",
                top: 0,
                background: "var(--bg, #0f1115)",
                padding: "10px 0",
                zIndex: 2,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="kpi">
                <span>Selezionato</span>
                <strong>#{selected.id} - {selected.title}</strong>
              </div>
              <div className="kpi">
                <span>Descrizione</span>
                <strong>{selected.description}</strong>
              </div>
              <div className="kpi">
                <span>Immagini / Prezzi</span>
                <strong>{selected.images.length} / {selected.prices.length}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ position: "sticky", top: 0 }}>
              Seleziona il prodotto principale.
            </div>
          )}
          <div
            className="product-list"
            style={{
              marginBottom: 14,
              maxHeight: "52vh",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={`merge-main-${product.id}`}
                product={product}
                active={selected?.id === product.id}
                onClick={() => void loadDetail(product.id)}
              />
            ))}
          </div>
        </div>

        {/* DA MERGIARE */}
        <div
          className="panel"
          style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <div className="panel-header">
            <h3>Da mergiare</h3>
            <span className="muted">Prodotto che verrà eliminato</span>
          </div>
          {mergeCandidateDetail ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                position: "sticky",
                top: 0,
                background: "var(--bg, #0f1115)",
                padding: "10px 0",
                zIndex: 2,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="kpi">
                <span>Selezionato</span>
                <strong>#{mergeCandidateDetail.id} - {mergeCandidateDetail.title}</strong>
              </div>
              <div className="kpi">
                <span>Descrizione</span>
                <strong>{mergeCandidateDetail.description}</strong>
              </div>
              <div className="kpi">
                <span>Immagini / Prezzi</span>
                <strong>{mergeCandidateDetail.images.length} / {mergeCandidateDetail.prices.length}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ position: "sticky", top: 0 }}>
              Seleziona il prodotto da mergiare.
            </div>
          )}
          <div
            className="product-list"
            style={{
              marginBottom: 14,
              maxHeight: "52vh",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {filteredProducts
              .filter((product) => product.id !== selected?.id)
              .map((product) => (
                <ProductCard
                  key={`merge-source-${product.id}`}
                  product={product}
                  active={mergeCandidateDetail?.id === product.id}
                  onClick={() => void loadMergeCandidate(product.id)}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Editing panel: mantenuto identico al behavior precedente (da rivedere in futuro) */}
      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        <div className="editing-panel">
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>
            Campi da salvare sul prodotto principale
          </h4>
          <div style={{ display: "grid", gap: 12 }}>
            {(
              [
                ["title", "Titolo"],
                ["description", "Descrizione"],
                ["brand", "Brand"],
                ["origin_type", "Origine"],
              ] as Array<[keyof typeof mergeDraft, string]>
            ).map(([field, label]) => (
              <div key={field as string} style={{ display: "grid", gap: 6 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      minWidth: 110,
                      color: "#94a3b8",
                      fontSize: 12,
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </span>
                  <button
                    className="button tiny"
                    onClick={() =>
                      setMergeDraft((current) => ({
                        ...current,
                        [field]: selected ? (selected as any)[field] || "" : "",
                      }))
                    }
                  >
                    Sinistra
                  </button>
                  <button
                    className="button tiny"
                    onClick={() =>
                      setMergeDraft((current) => ({
                        ...current,
                        [field]: mergeCandidateDetail
                          ? (mergeCandidateDetail as any)[field] || ""
                          : "",
                      }))
                    }
                  >
                    Destra
                  </button>
                </div>
                {field === "description" ? (
                  <textarea
                    className="textarea"
                    value={mergeDraft.description}
                    onChange={(e) =>
                      setMergeDraft((current) => ({
                        ...current,
                        description: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <input
                    className="input"
                    value={(mergeDraft as any)[field]}
                    onChange={(e) =>
                      setMergeDraft((current) => ({
                        ...current,
                        [field]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <div style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    minWidth: 110,
                    color: "#94a3b8",
                    fontSize: 12,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Archiviato
                </span>
                <button
                  className={`button tiny ${mergeDraft.archived ? "primary" : "secondary"}`}
                  onClick={() =>
                    setMergeDraft((current) => ({
                      ...current,
                      archived: !current.archived,
                    }))
                  }
                >
                  {mergeDraft.archived ? "Sì" : "No"}
                </button>
                <button
                  className="button tiny"
                  onClick={() =>
                    setMergeDraft((current) => ({
                      ...current,
                      archived: selected?.archived ?? false,
                    }))
                  }
                >
                  Sinistra
                </button>
                <button
                  className="button tiny"
                  onClick={() =>
                    setMergeDraft((current) => ({
                      ...current,
                      archived: mergeCandidateDetail?.archived ?? false,
                    }))
                  }
                >
                  Destra
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
