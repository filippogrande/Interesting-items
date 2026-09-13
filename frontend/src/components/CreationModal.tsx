import React from "react";

type CreationModalProps = {
  open: boolean;
  draft: any;
  onClose: () => void;
  onChange: (patch: any) => void;
  onCreate: () => void;
  tags: any[];
};

export default function CreationModal({
  open,
  draft,
  onClose,
  onChange,
  onCreate,
  tags,
}: CreationModalProps) {
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
