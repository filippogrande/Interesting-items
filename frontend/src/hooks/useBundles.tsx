import { useState, useCallback } from "react";

type BundleDraft = {
  title: string;
  amount: string;
  currency: string;
  sourceUrl: string;
  notes: string;
  productIds: number[];
};

export function useBundles({
  loadDetail,
  loadProducts,
}: {
  loadDetail: (productId: number) => Promise<any>;
  loadProducts: (
    tagId?: number | "" | "untagged",
    sourceSite?: string,
    excludeTags?: number[],
    skipAutoSelect?: boolean,
  ) => Promise<any[]>;
}) {
  const [bundleCreatorOpen, setBundleCreatorOpen] = useState(false);
  const [bundleDraft, setBundleDraft] = useState<BundleDraft>({
    title: "",
    amount: "",
    currency: "EUR",
    sourceUrl: "",
    notes: "",
    productIds: [],
  });

  const createBundle = useCallback(async () => {
    const productIds = Array.from(
      new Set(bundleDraft.productIds),
    ).filter(Boolean);
    if (productIds.length < 2) {
      throw new Error("Seleziona almeno due prodotti per creare un bundle");
    }
    if (!bundleDraft.amount.trim() || !bundleDraft.sourceUrl.trim()) {
      throw new Error("Inserisci prezzo e link del bundle");
    }
    const resp = await fetch(`/api/bundles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: bundleDraft.title.trim() || undefined,
        amount: Number(bundleDraft.amount.replace(/,/g, ".")),
        currency: bundleDraft.currency || "EUR",
        source_url: bundleDraft.sourceUrl.trim(),
        notes: bundleDraft.notes.trim() || undefined,
        product_ids: productIds,
      }),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    setBundleCreatorOpen(false);
    setBundleDraft({
      title: "",
      amount: "",
      currency: "EUR",
      sourceUrl: "",
      notes: "",
      productIds: [],
    });
    return resp.json();
  }, [bundleDraft]);

  const createBundleFromPrice = useCallback((price: any) => {
    setBundleDraft((current) => ({
      ...current,
      amount: String(price.amount),
      currency: price.currency || "EUR",
      sourceUrl: price.source_url || "",
    }));
    setBundleCreatorOpen(true);
  }, []);

  return {
    bundleCreatorOpen,
    setBundleCreatorOpen,
    bundleDraft,
    setBundleDraft,
    createBundle,
    createBundleFromPrice,
  };
}
