import { useState, useCallback } from "react";
import { fetchJson } from "../utils/format";
import type { ProductDetail } from "../types";

type MergeDraft = {
  title: string;
  description: string;
  brand: string;
  origin_type: string;
  archived: boolean;
};

const emptyDraft: MergeDraft = {
  title: "",
  description: "",
  brand: "",
  origin_type: "",
  archived: false,
};

function uniqueIds(lists: Array<Array<{ id: number }>>): number[] {
  const seen = new Set<number>();
  for (const list of lists) {
    for (const item of list) {
      seen.add(item.id);
    }
  }
  return Array.from(seen);
}

export function useMerge({
  loadProducts,
  loadDetail,
}: {
  loadProducts: (
    tagId?: number | "" | "untagged",
    sourceSite?: string,
    excludeTags?: number[],
    skipAutoSelect?: boolean,
  ) => Promise<ProductDetail[]>;
  loadDetail: (productId: number) => Promise<ProductDetail>;
}) {
  const [mergeCandidateDetail, setMergeCandidateDetail] =
    useState<ProductDetail | null>(null);
  const [mergeCandidateLoading, setMergeCandidateLoading] = useState(false);
  const [mergePhase, setMergePhase] = useState<"chooser" | "editor">(
    "chooser",
  );
  const [mergeDraft, setMergeDraft] = useState<MergeDraft>(emptyDraft);
  const [keepImageIds, setKeepImageIds] = useState<number[]>([]);
  const [keepPriceIds, setKeepPriceIds] = useState<number[]>([]);
  const [keepSourceUrlIds, setKeepSourceUrlIds] = useState<number[]>([]);
  const [mergeTagIds, setMergeTagIds] = useState<number[]>([]);

  const loadMergeCandidate = useCallback(
    async (productId: number) => {
      setMergeCandidateLoading(true);
      try {
        const detail = await loadDetail(productId);
        setMergeCandidateDetail(detail);
        return detail;
      } finally {
        setMergeCandidateLoading(false);
      }
    },
    [loadDetail],
  );

  // Apre l'editor di confronto: inizializza il draft dai campi del prodotto
  // principale (sinistra) e le liste "keep" come UNIONE dei due prodotti.
  const openMergeEditor = useCallback(
    (main: ProductDetail, candidate: ProductDetail) => {
      setMergeDraft({
        title: main.title || "",
        description: main.description || "",
        brand: main.brand || "",
        origin_type: main.origin_type || "",
        archived: main.archived,
      });
      setKeepImageIds(
        uniqueIds([main.images || [], candidate.images || []]),
      );
      setKeepPriceIds(
        uniqueIds([main.prices || [], candidate.prices || []]),
      );
      setKeepSourceUrlIds(
        uniqueIds([main.source_urls || [], candidate.source_urls || []]),
      );
      setMergeTagIds(uniqueIds([main.tags || [], candidate.tags || []]));
      setMergePhase("editor");
    },
    [],
  );

  // Torna alla vista selezione CONSERVANDO selezioni e modifiche (in modo che
  // un nuovo "Prosegui" riparta da dove era rimasto).
  const goBackToChooser = useCallback(() => {
    setMergePhase("chooser");
  }, []);

  const commitMerge = useCallback(
    async (selectedId: number) => {
      if (!mergeCandidateDetail) {
        throw new Error("No merge candidate selected");
      }

      const payload = {
        main_product_id: selectedId,
        merge_product_id: mergeCandidateDetail.id,
        title: mergeDraft.title || undefined,
        description: mergeDraft.description || undefined,
        brand: mergeDraft.brand || undefined,
        origin_type: mergeDraft.origin_type || undefined,
        archived: mergeDraft.archived,
        keep_image_ids: keepImageIds,
        keep_price_ids: keepPriceIds,
        keep_source_url_ids: keepSourceUrlIds,
        tag_ids: mergeTagIds,
      };

      const resp = await fetch("/api/products/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      setMergePhase("chooser");
      setMergeCandidateDetail(null);
      setMergeDraft(emptyDraft);
      setKeepImageIds([]);
      setKeepPriceIds([]);
      setKeepSourceUrlIds([]);
      setMergeTagIds([]);
      return resp.json();
    },
    [
      mergeCandidateDetail,
      mergeDraft,
      keepImageIds,
      keepPriceIds,
      keepSourceUrlIds,
      mergeTagIds,
    ],
  );

  return {
    mergeCandidateDetail,
    mergeCandidateLoading,
    mergePhase,
    setMergePhase,
    mergeDraft,
    setMergeDraft,
    keepImageIds,
    setKeepImageIds,
    keepPriceIds,
    setKeepPriceIds,
    keepSourceUrlIds,
    setKeepSourceUrlIds,
    mergeTagIds,
    setMergeTagIds,
    loadMergeCandidate,
    openMergeEditor,
    goBackToChooser,
    commitMerge,
  };
}
