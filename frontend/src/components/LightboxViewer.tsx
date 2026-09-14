import React from "react";

type LightboxViewerProps = {
  selected: {
    images: Array<{ url?: string }>;
    title: string;
  } | null;
  viewerOpen: boolean;
  setViewerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewerIndex: number;
  moveViewer: (delta: number) => void;
};

export function LightboxViewer({
  selected,
  viewerOpen,
  setViewerOpen,
  viewerIndex,
  moveViewer,
}: LightboxViewerProps) {
  if (!viewerOpen || !selected) return null;
  return (
    <div
      className="lightbox-overlay"
      onClick={() => setViewerOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="lightbox-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="lightbox-close button secondary"
          onClick={() => setViewerOpen(false)}
        >
          Chiudi
        </button>
        <div className="lightbox-nav">
          <button className="button" onClick={() => moveViewer(-1)}>
            ‹
          </button>
          <img
            src={selected.images[viewerIndex]?.url ?? undefined}
            alt={selected.title}
          />
          <button className="button" onClick={() => moveViewer(1)}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
