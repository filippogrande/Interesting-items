import React from "react";

type ProductCardProps = {
  product: any;
  active?: boolean;
  onClick?: () => void;
  footer?: React.ReactNode;
};

export default function ProductCard({ product, active, onClick, footer }: ProductCardProps) {
  return (
    <button
      key={product.id}
      className={`product-card ${active ? "active" : ""}`}
      onClick={onClick}
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
          <span>
            {formatDate(product.scraped_at || product.created_at)}
          </span>
        </div>
        <h3>{product.title}</h3>
        <p>{product.description}</p>
        <div className="product-card-meta">
          <span>{product.images_count} img</span>
          <span>{product.prices_count} prezzi</span>
          <span>{product.bundles_count || 0} bundle</span>
          {footer}
        </div>
      </div>
    </button>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
