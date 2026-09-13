import { useState, useCallback } from "react";
import { fetchJson } from "../utils/format";
import type { ProductDetail } from "../types";

type MergeDraft = {
  title: string;
  description: string;
  brand: string;
  origin_type: string;
  product_metadata: string;
  category_id: string;
  archived: boolean;
};

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
  const [mergeDraft, setMergeDraft] = useState<MergeDraft>({
    title: "",
    description: "",
    brand: "",
    origin_type: "",
    product_metadata: "",
    category_id: "",
    archived: false,
  });
  const [mergeSelectedImageIds, setMergeSelectedImageIds] = useState<number[]>(
    [],
  );
  const [mergeSelectedPriceIds, setMergeSelectedPriceIds] = useState<number[]>(
    [],
  );
  const [mergeSelectedSourceUrlIds, setMergeSelectedSourceUrlIds] = useState<
    number[]
  >([]);

  const buildMergeDraft = useCallback((product: ProductDetail): MergeDraft => {
    return {
      title: product.title || "",
      description: product.description || "",
      brand: product.brand || "",
      origin_type: product.origin_type || "",
      product_metadata: "",
      category_id: "",
      archived: product.archived,
    };
  }, []);

  const loadMergeCandidate = useCallback(async (productId: number) => {
    setMergeCandidateLoading(true);
    try {
      const detail = await fetchJson<ProductDetail>(
        `/api/dashboard/products/${productId}`,
      );
      setMergeCandidateDetail(detail);
      setMergeSelectedImageIds(detail.images.map((image: any) => image.id));
      setMergeSelectedPriceIds(detail.prices.map((price: any) => price.id));
      setMergeSelectedSourceUrlIds(
        detail.source_urls.map((source: any) => source.id),
      );
      return detail;
    } finally {
      setMergeCandidateLoading(false);
    }
  }, []);

  const openMergeEditor = useCallback(
    (product: ProductDetail) => {
      setMergePhase("editor");
      setMergeDraft(buildMergeDraft(product));
    },
    [buildMergeDraft],
  );

  const commitMerge = useCallback(async () => {
    // Implementation would call the API to merge products
    // Placeholder - actual implementation depends on the API
    setMergePhase("chooser");
    setMergeCandidateDetail(null);
  }, []);

  return {
    mergeCandidateDetail,
    mergeCandidateLoading,
    mergePhase,
    setMergePhase,
    mergeDraft,
    setMergeDraft,
    mergeSelectedImageIds,
    setMergeSelectedImageIds,
    mergeSelectedPriceIds,
    setMergeSelectedPriceIds,
    mergeSelectedSourceUrlIds,
    setMergeSelectedSourceUrlIds,
    buildMergeDraft,
    loadMergeCandidate,
    openMergeEditor,
    commitMerge,
  };
}
