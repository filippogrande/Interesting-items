import { useState, useMemo, useCallback } from "react";
import { fetchJson } from "../utils/format";
import type { ProductSummary } from "../types";

export function useProducts() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | "" | "untagged">(
    "",
  );
  const [selectedSourceSite, setSelectedSourceSite] = useState<string>("");
  const [excludeTagIds, setExcludeTagIds] = useState<number[]>([]);
  const [excludeTagsExpanded, setExcludeTagsExpanded] = useState(false);

  const loadProducts = useCallback(
    async (
      tagId?: number | "" | "untagged",
      sourceSite?: string,
      excludeTags?: number[],
      skipAutoSelect?: boolean,
    ) => {
      setLoadingList(true);
      setError(null);
      try {
        let list: ProductSummary[];
        if (tagId === "untagged") {
          list = await fetchJson<ProductSummary[]>(
            "/api/dashboard/products/untagged",
          );
        } else {
          const params = new URLSearchParams({ limit: "1000" });
          if (tagId !== undefined && tagId !== "") {
            params.set("tag_id", String(tagId));
          }
          if (sourceSite && sourceSite.trim()) {
            params.set("source_site", sourceSite.trim());
          }
          if (excludeTags && excludeTags.length > 0) {
            params.set("exclude_tag_ids", excludeTags.join(","));
          }
          list = await fetchJson<ProductSummary[]>(
            `/api/dashboard/products?${params.toString()}`,
          );
        }
        setProducts(list);
        return list;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Errore nel caricamento dati",
        );
        throw err;
      } finally {
        setLoadingList(false);
      }
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setSelectedTagId("");
    setSelectedSourceSite("");
    setExcludeTagIds([]);
    setQuery("");
  }, []);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [products, query]);

  const stats = useMemo(
    () => ({
      products: products.length,
      images: products.reduce((sum, p) => sum + (p.images_count || 0), 0),
      prices: products.reduce((sum, p) => sum + (p.prices_count || 0), 0),
      sources: new Set(
        products.map((p) => p.origin_type).filter(Boolean),
      ).size,
      tags: new Set(
        products.flatMap((p) => (p as any).tags || []).map((t: any) => t.id),
      ).size,
    }),
    [products],
  );

  return {
    products,
    setProducts,
    loadingList,
    error,
    setError,
    query,
    setQuery,
    selectedTagId,
    setSelectedTagId,
    selectedSourceSite,
    setSelectedSourceSite,
    excludeTagIds,
    setExcludeTagIds,
    excludeTagsExpanded,
    setExcludeTagsExpanded,
    loadProducts,
    resetFilters,
    filteredProducts,
    stats,
  };
}
