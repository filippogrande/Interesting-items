import { useState, useCallback, useRef } from "react";
import { fetchJson, makeEmptyPrice, makeEmptySourceUrl } from "../utils/format";
import type { ProductDetail } from "../types";

export function useProductDetail() {
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductDetail | null>(null);
  const [editingTagIds, setEditingTagIds] = useState<number[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [draftPendingUploads, setDraftPendingUploads] = useState<File[]>([]);
  const [draftDeletedImageIds, setDraftDeletedImageIds] = useState<number[]>([]);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);

  const loadDetail = useCallback(async (productId: number) => {
    setLoadingDetail(true);
    try {
      const detail = await fetchJson<ProductDetail>(
        `/api/dashboard/products/${productId}`,
      );
      setSelected(detail);
      setDraft(null);
      setEditing(false);
      setEditingTagIds(detail.tags.map((t: any) => t.id));
      return detail;
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const refreshDetail = useCallback(async (productId: number, keepEditing = false) => {
    const detail = await fetchJson<ProductDetail>(
      `/api/dashboard/products/${productId}`,
    );
    setSelected(detail);
    setDraft(keepEditing ? detail : null);
    setEditing(keepEditing);
    setEditingTagIds(detail.tags.map((t: any) => t.id));
  }, []);

  const deleteProductImage = useCallback(async (imageId: number) => {
    if (!selected) return;
    if (editing) {
      setDraftDeletedImageIds((current) =>
        current.includes(imageId)
          ? current.filter((id) => id !== imageId)
          : [...current, imageId],
      );
      return;
    }
    if (!confirm("Eliminare questa immagine?")) return;
    await fetch(`/api/images/${imageId}`, { method: "DELETE" });
    await refreshDetail(selected.id, true);
  }, [selected, editing, refreshDetail]);

  const uploadProductImage = useCallback(async (file: File) => {
    if (!selected) return;
    if (editing) {
      setDraftPendingUploads((current) => [...current, file]);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/products/${selected.id}/images/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    await refreshDetail(selected.id, true);
  }, [selected, editing, refreshDetail]);

  const moveViewer = useCallback((delta: number) => {
    const imageCount = selected?.images.length || 0;
    if (imageCount <= 0) return;
    setViewerIndex((index) => (index + delta + imageCount) % imageCount);
  }, [selected]);

  const appendEditablePair = useCallback(() => {
    if (editing && draft) {
      const copy = { ...draft };
      copy.prices = [...copy.prices, makeEmptyPrice()];
      copy.source_urls = [...copy.source_urls, makeEmptySourceUrl()];
      setDraft(copy);
      return;
    }
    if (selected) {
      setDraft({
        ...selected,
        prices: [...selected.prices, makeEmptyPrice()],
        source_urls: [...selected.source_urls, makeEmptySourceUrl()],
      });
      setEditing(true);
    }
  }, [editing, draft, selected]);

  const duplicateSelectedProduct = useCallback(async () => {
    if (!selected) return;
    const payload = {
      title: `${selected.title} (copy)`,
      description: selected.description,
      brand: selected.brand,
      origin_type: selected.origin_type,
    };
    const resp = await fetch(`/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }, [selected]);

  const toggleProductTag = useCallback((tagId: number) => {
    setEditingTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }, []);

  return {
    selected,
    setSelected,
    editing,
    setEditing,
    draft,
    setDraft,
    editingTagIds,
    setEditingTagIds,
    loadingDetail,
    viewerOpen,
    setViewerOpen,
    viewerIndex,
    setViewerIndex,
    draftPendingUploads,
    setDraftPendingUploads,
    draftDeletedImageIds,
    setDraftDeletedImageIds,
    imageUploadRef,
    loadDetail,
    refreshDetail,
    deleteProductImage,
    uploadProductImage,
    moveViewer,
    appendEditablePair,
    duplicateSelectedProduct,
    toggleProductTag,
  };
}
