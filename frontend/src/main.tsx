import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import TagsView from "./components/TagsView";
import SourcesView from "./components/SourcesView";
import "./styles.css";
import ProductCard from "./components/ProductCard";
import MergeView from "./components/MergeView";
import { fetchJson, formatDate, formatMoney, labelFromHost, derivePlatformLabel, makeEmptyPrice, makeEmptySourceUrl, buildTagLabel, TAG_KIND_LABELS, TAG_KIND_ORDER } from "./utils/format";
import type { ProductSummary, Tag, SourceWebsite, ProductDetail } from "./types";

function App() {
  const appVersion = (import.meta as any)?.env?.VITE_APP_VERSION ?? "v0.1.11";
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductDetail | null>(null);
  const [editingTagIds, setEditingTagIds] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagKind, setNewTagKind] = useState<Tag["kind"]>("taxonomy");
  const [newTagParentId, setNewTagParentId] = useState<number | "">("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | "" | "untagged">(
    "",
  );
  const [selectedSourceSite, setSelectedSourceSite] = useState<string>("");
  const [excludeTagIds, setExcludeTagIds] = useState<number[]>([]);
  const [excludeTagsExpanded, setExcludeTagsExpanded] = useState(false);
  const [view, setView] = useState<"dashboard" | "tags" | "sources" | "merge">(
    "dashboard",
  );
  const [tagsStats, setTagsStats] = useState<{
    tags: Array<Tag & { count: number }>;
    untagged_count: number;
  } | null>(null);
  const [sourceWebsitesStats, setSourceWebsitesStats] = useState<{
    websites: SourceWebsite[];
  } | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [mergeCandidateDetail, setMergeCandidateDetail] =
    useState<ProductDetail | null>(null);
  const [mergeCandidateLoading, setMergeCandidateLoading] = useState(false);
  const [mergePhase, setMergePhase] = useState<"chooser" | "editor">(
    "chooser",
  );
  const [mergeDraft, setMergeDraft] = useState({
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

  // new product creation state
  const [creating, setCreating] = useState(false);
  const [newProductDraft, setNewProductDraft] = useState<
    Partial<ProductDetail>
  >({
    title: "",
    description: "",
    brand: "",
    origin_type: "",
    archived: false,
    prices: [],
    source_urls: [],
    images: [],
    tags: [],
  });
  const [bundleCreatorOpen, setBundleCreatorOpen] = useState(false);
  const [bundleDraft, setBundleDraft] = useState({
    title: "",
    amount: "",
    currency: "EUR",
    sourceUrl: "",
    notes: "",
    productIds: [] as number[],
  });
  // images changed while editing (not yet saved)
  const [draftPendingUploads, setDraftPendingUploads] = useState<File[]>([]);
  const [draftDeletedImageIds, setDraftDeletedImageIds] = useState<number[]>(
    [],
  );
  function buildMergeDraft(product: ProductDetail) {
    return {
      title: product.title || "",
      description: product.description || "",
      brand: product.brand || "",
      origin_type: product.origin_type || "",
      product_metadata: "",
      category_id: "",
      archived: product.archived,
    };
  }

  function moveViewer(delta: number) {
    const imageCount = selected?.images.length || 0;
    if (imageCount <= 0) return;
    setViewerIndex((index) => (index + delta + imageCount) % imageCount);
  }

  function appendEditablePair() {
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
  }

  async function loadProducts(
    tagId?: number | "" | "untagged",
    sourceSite?: string,
    excludeTags?: number[],
    skipAutoSelect?: boolean,
  ) {
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
      if (!skipAutoSelect) {
        if (list.length > 0) {
          void loadDetail(list[0].id);
        } else {
          setSelected(null);
          setDraft(null);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore nel caricamento dati",
      );
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(productId: number) {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await fetchJson<ProductDetail>(
        `/api/dashboard/products/${productId}`,
      );
      setSelected(detail);
      setDraft(null);
      setEditing(false);
      setEditingTagIds(detail.tags.map((t) => t.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore nel dettaglio prodotto",
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshDetail(productId: number, keepEditing = false) {
    const detail = await fetchJson<ProductDetail>(
      `/api/dashboard/products/${productId}`,
    );
    setSelected(detail);
    setDraft(keepEditing ? detail : null);
    setEditing(keepEditing);
    setEditingTagIds(detail.tags.map((t) => t.id));
  }

  async function loadMergeCandidate(productId: number) {
    setMergeCandidateLoading(true);
    setError(null);
    try {
      const detail = await fetchJson<ProductDetail>(
        `/api/dashboard/products/${productId}`,
      );
      setMergeCandidateDetail(detail);
      setMergeSelectedImageIds(detail.images.map((image) => image.id));
      setMergeSelectedPriceIds(detail.prices.map((price) => price.id));
      setMergeSelectedSourceUrlIds(
        detail.source_urls.map((source) => source.id),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore caricamento prodotto merge",
      );
    } finally {
      setMergeCandidateLoading(false);
    }
  }

  async function deleteProductImage(imageId: number) {
    if (!selected) return;
    if (editing) {
      // in edit mode, toggle mark-for-deletion locally
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
  }

  async function uploadProductImage(file: File) {
    if (!selected) return;
    if (editing) {
      // queue the upload locally until save
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
  }

  async function createNewProduct() {
    setError(null);
    try {
      const payload: any = {
        title: newProductDraft.title || "Untitled",
        description: newProductDraft.description || "",
        brand: newProductDraft.brand || null,
        origin_type: newProductDraft.origin_type || null,
        archived: !!newProductDraft.archived,
      };
      const resp = await fetch(`/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const created = await resp.json();
      await loadProducts(
        selectedTagId as number | "" | "untagged",
        selectedSourceSite,
        excludeTagIds,
      );
      await loadDetail(created.id);
      setCreating(false);
      setNewProductDraft({
        title: "",
        description: "",
        brand: "",
        origin_type: "",
        archived: false,
        prices: [],
        source_urls: [],
        images: [],
        tags: [],
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore creazione prodotto",
      );
    }
  }

  async function createBundle() {
    if (!selected) return;
    const productIds = Array.from(
      new Set([selected.id, ...bundleDraft.productIds]),
    ).filter(Boolean);
    if (productIds.length < 2) {
      setError("Seleziona almeno due prodotti per creare un bundle");
      return;
    }
    if (!bundleDraft.amount.trim() || !bundleDraft.sourceUrl.trim()) {
      setError("Inserisci prezzo e link del bundle");
      return;
    }
    try {
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
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setBundleDraft({
        title: "",
        amount: "",
        currency: "EUR",
        sourceUrl: "",
        notes: "",
        productIds: [selected.id],
      });
      setBundleCreatorOpen(false);
      await loadDetail(selected.id);
      await loadProducts(
        selectedTagId as number | "" | "untagged",
        selectedSourceSite,
        excludeTagIds,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione bundle");
    }
  }

  async function createBundleFromPrice(
    price: { id: number; amount: number; currency: string },
    idx: number,
  ) {
    if (!selected) return;
    try {
      const source =
        (selected.source_urls[idx] ?? selected.source_urls[0]) || null;
      const payload = {
        title: undefined,
        amount: Number(price.amount),
        currency: price.currency || "EUR",
        source_url: source?.url || "",
        notes: undefined,
        product_ids: [selected.id],
      } as any;

      const resp = await fetch(`/api/bundles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await loadDetail(selected.id);
      setBundleCreatorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione bundle");
    }
  }

  function openMergeEditor() {
    if (!selected || !mergeCandidateDetail) {
      setError("Seleziona il prodotto principale e quello da mergiare");
      return;
    }
    setMergeDraft(buildMergeDraft(selected));
    setMergePhase("editor");
  }

  async function duplicateSelectedProduct() {
    if (!selected) return;
    try {
      const resp = await fetch(`/api/products/${selected.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const duplicated = (await resp.json()) as ProductDetail;
      await loadProducts(
        selectedTagId as number | "" | "untagged",
        selectedSourceSite,
        excludeTagIds,
        true,
      );
      await loadDetail(duplicated.id);
      setView("dashboard");
      setEditing(false);
      setDraft(null);
      setDraftPendingUploads([]);
      setDraftDeletedImageIds([]);
      setMergePhase("chooser");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore duplicazione prodotto");
    }
  }

  async function commitMerge() {
    if (!selected || !mergeCandidateDetail) {
      setError("Seleziona un prodotto principale e uno da mergiare");
      return;
    }
    if (selected.id === mergeCandidateDetail.id) {
      setError("I due prodotti devono essere diversi");
      return;
    }
    try {
      const resp = await fetch(`/api/products/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          main_product_id: selected.id,
          merge_product_id: mergeCandidateDetail.id,
          title: mergeDraft.title,
          description: mergeDraft.description,
          brand: mergeDraft.brand,
          origin_type: mergeDraft.origin_type,
          product_metadata: mergeDraft.product_metadata || null,
          category_id: mergeDraft.category_id
            ? Number(mergeDraft.category_id)
            : null,
          archived: mergeDraft.archived,
          selected_image_ids: mergeSelectedImageIds,
          selected_price_ids: mergeSelectedPriceIds,
          selected_source_url_ids: mergeSelectedSourceUrlIds,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const merged = await resp.json();
      setMergeCandidateDetail(null);
      setMergePhase("chooser");
      setMergeSelectedImageIds([]);
      setMergeSelectedPriceIds([]);
      setMergeSelectedSourceUrlIds([]);
      setView("dashboard");
      await loadProducts(
        selectedTagId as number | "" | "untagged",
        selectedSourceSite,
        excludeTagIds,
      );
      await loadDetail(merged.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore merge prodotti");
    }
  }

  async function toggleProductTag(
    productId: number,
    tagId: number,
    shouldAdd: boolean,
  ) {
    try {
      if (shouldAdd) {
        await fetch(`/api/products/${productId}/tags/${tagId}`, {
          method: "POST",
        });
      } else {
        await fetch(`/api/products/${productId}/tags/${tagId}`, {
          method: "DELETE",
        });
      }
      await loadDetail(productId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore modifica tag");
    }
  }

  useEffect(() => {
    void loadProducts(
      selectedTagId as number | "" | "untagged",
      selectedSourceSite,
      excludeTagIds,
    );
  }, [selectedTagId, selectedSourceSite, excludeTagIds]);

  useEffect(() => {
    if (!viewerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewerOpen(false);
      if (e.key === "ArrowLeft") moveViewer(-1);
      if (e.key === "ArrowRight") moveViewer(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, selected]);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<Tag[]>("/api/tags")
      .then((data) => {
        if (!cancelled) setTags(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Errore caricamento tag",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setBundleDraft((current) => ({
      ...current,
      productIds: Array.from(new Set([selected.id, ...current.productIds])),
    }));
  }, [selected?.id]);

  useEffect(() => {
    if (view !== "merge" || !selected) return;
    setMergeDraft(buildMergeDraft(selected));
  }, [view, selected?.id]);

  useEffect(() => {
    if (view !== "merge" || !mergeCandidateDetail) return;
    setMergeSelectedImageIds(
      mergeCandidateDetail.images.map((image) => image.id),
    );
    setMergeSelectedPriceIds(
      mergeCandidateDetail.prices.map((price) => price.id),
    );
    setMergeSelectedSourceUrlIds(
      mergeCandidateDetail.source_urls.map((source) => source.id),
    );
  }, [view, mergeCandidateDetail?.id]);

  useEffect(() => {
    void loadSourceWebsitesStats();
  }, []);

  async function loadTagsStats() {
    try {
      const data = await fetchJson<{
        tags: Array<Tag & { count: number }>;
        untagged_count: number;
      }>("/api/tags/stats");
      setTagsStats(data);
      setTags(
        data.tags.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          kind: t.kind,
          parent_id: t.parent_id,
          tag_metadata: t.tag_metadata,
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore caricamento tag stats",
      );
    }
  }

  async function loadSourceWebsitesStats() {
    try {
      const data = await fetchJson<{ websites: SourceWebsite[] }>(
        "/api/sourcewebsites/stats",
      );
      setSourceWebsitesStats(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore caricamento source websites",
      );
    }
  }

  async function createTag() {
    setError(null);
    if (!newTagName.trim()) {
      setError("Nome tag richiesto");
      return;
    }
    try {
      const payload: any = { name: newTagName.trim(), kind: newTagKind };
      if (newTagParentId !== "") payload.parent_id = Number(newTagParentId);
      const resp = await fetch(`/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const created: Tag = await resp.json();
      const fresh = await fetchJson<Tag[]>("/api/tags");
      setTags(fresh);
      setNewTagName("");
      setNewTagParentId("");
      const freshMap = new Map<number, Tag>(fresh.map((t) => [t.id, t]));
      const ancestors: number[] = [];
      let cur = freshMap.get(created.id);
      while (cur && cur.parent_id) {
        const pid = cur.parent_id;
        if (!pid) break;
        ancestors.unshift(pid);
        cur = freshMap.get(pid);
      }
      setEditingTagIds((prev) =>
        Array.from(new Set([...prev, ...ancestors, created.id])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione tag");
    }
  }

  function resetFilters() {
    setQuery("");
    setSelectedTagId("");
    setSelectedSourceSite("");
    setExcludeTagIds([]);
    setExcludeTagsExpanded(false);
    setSelected(null);
    setDraft(null);
  }

  const tagMap = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  function getAncestorIds(tagId: number): number[] {
    const result: number[] = [];
    let current = tagMap.get(tagId);
    while (current && current.parent_id) {
      const pid = current.parent_id;
      if (!pid) break;
      result.unshift(pid);
      current = tagMap.get(pid);
    }
    return result;
  }

  const tagsByKind = useMemo(() => {
    const grouped: Record<Tag["kind"], Tag[]> = {
      taxonomy: [],
      store: [],
      project: [],
    };
    for (const tag of tags) {
      grouped[tag.kind].push(tag);
    }
    return grouped;
  }, [tags]);

  function toggleExcludeTag(tagId: number) {
    setExcludeTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  function clearExcludeTags() {
    setExcludeTagIds([]);
  }

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      `${product.title} ${product.description} ${product.origin_type || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [products, query]);

  const stats = useMemo(
    () => ({
      products: products.length,
      images: products.reduce((sum, item) => sum + item.images_count, 0),
      prices: products.reduce((sum, item) => sum + item.prices_count, 0),
      sources: sourceWebsitesStats?.websites.length ?? 0,
      tags: tags.length,
    }),
    [products, tags, sourceWebsitesStats],
  );

  return (
    <div className="app-shell">
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
          <button
            className="button secondary"
            onClick={() => window.location.reload()}
          >
            Aggiorna
          </button>
          <span className="status-pill">
            {loadingList ? "Caricamento..." : "Online"}
          </span>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          label="Prodotti"
          value={stats.products}
          onClick={() => {
            resetFilters();
            setView("dashboard");
            void loadProducts("", "", [], true);
          }}
        />
        <StatCard
          label="Immagini"
          value={stats.images}
          onClick={() => {
            resetFilters();
            setView("dashboard");
            void loadProducts("", "", [], true);
          }}
        />
        <StatCard
          label="Prezzi"
          value={stats.prices}
          onClick={() => {
            resetFilters();
            setView("dashboard");
            void loadProducts("", "", [], true);
          }}
        />
        <StatCard
          label="Unisci i prodotti"
          value="↔"
          onClick={() => {
            resetFilters();
            setMergePhase("chooser");
            setView("merge");
            if (selected) {
              setMergeDraft(buildMergeDraft(selected));
            }
          }}
        />
        <StatCard
          label="Source websites"
          value={stats.sources}
          onClick={() => {
            resetFilters();
            setView("sources");
            void loadSourceWebsitesStats();
          }}
        />
        <StatCard
          label="Tag"
          value={stats.tags}
          onClick={() => {
            resetFilters();
            setView("tags");
            void loadTagsStats();
          }}
        />
      </section>

      <main className="layout">
        {view === "tags" ? (
          <TagsView
            error={error}
            statsProducts={products.length}
            tagsStats={tagsStats}
            selectedTagId={selectedTagId}
            setSelectedTagId={setSelectedTagId}
            selectedSourceSite={selectedSourceSite}
            setSelectedSourceSite={setSelectedSourceSite}
            query={query}
            setQuery={setQuery}
            TAG_KIND_ORDER={TAG_KIND_ORDER}
            TAG_KIND_LABELS={TAG_KIND_LABELS}
            tagsByKind={tagsByKind}
            excludeTagsExpanded={excludeTagsExpanded}
            setExcludeTagsExpanded={setExcludeTagsExpanded}
            excludeTagIds={excludeTagIds}
            toggleExcludeTag={toggleExcludeTag}
            clearExcludeTags={clearExcludeTags}
            tagMap={tagMap}
            filteredProducts={filteredProducts}
            selected={selected}
            loadDetail={loadDetail}
            loadingList={loadingList}
            formatDate={formatDate}
            formatMoney={formatMoney}
            onBack={() => setView("dashboard")}
            onRefresh={() => void loadTagsStats()}
          />
        ) : view === "sources" ? (
          <SourcesView
            sourceWebsitesStats={sourceWebsitesStats}
            totalProducts={products.length}
            error={error}
            onBack={() => setView("dashboard")}
            onRefresh={() => void loadSourceWebsitesStats()}
            onSelectAll={() => {
              setSelectedSourceSite("");
              void loadProducts(
                selectedTagId as number | "" | "untagged",
                "",
                excludeTagIds,
              );
            }}
            onSelectSite={(siteName: string) => {
              setSelectedSourceSite(siteName);
              void loadProducts(
                selectedTagId as number | "" | "untagged",
                siteName,
                excludeTagIds,
              );
            }}
          />
        ) : view === "merge" ? (
          <MergeView
            filteredProducts={filteredProducts}
            selected={selected}
            mergeCandidateDetail={mergeCandidateDetail}
            query={query}
            setQuery={setQuery}
            error={error}
            setView={setView}
            loadDetail={loadDetail}
            loadMergeCandidate={loadMergeCandidate}
            commitMerge={commitMerge}
            mergeDraft={mergeDraft}
            setMergeDraft={setMergeDraft}
            mergeSelectedImageIds={mergeSelectedImageIds}
            setMergeSelectedImageIds={setMergeSelectedImageIds}
            mergeSelectedPriceIds={mergeSelectedPriceIds}
            setMergeSelectedPriceIds={setMergeSelectedPriceIds}
            mergeSelectedSourceUrlIds={mergeSelectedSourceUrlIds}
            setMergeSelectedSourceUrlIds={setMergeSelectedSourceUrlIds}
            derivePlatformLabel={derivePlatformLabel}
            formatMoney={formatMoney}
            selectedTagId={selectedTagId}
            selectedSourceSite={selectedSourceSite}
            excludeTagIds={excludeTagIds}
          />
        ) : (
          <section className="panel list-panel">
            {error && <div className="error-box">{error}</div>}

            <div style={{ marginBottom: 16 }}>
              <input
                className="search"
                placeholder="Cerca prodotti"
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
              <div className="panel" style={{ minHeight: 0 }}>
                <div className="panel-header">
                  <h3>Elenco prodotti</h3>
                  <span className="muted">{filteredProducts.length} risultati</span>
                </div>
                <div className="product-list" style={{ marginBottom: 14 }}>
                  {filteredProducts.map((product) => (
                    <button
                      key={`dash-${product.id}`}
                      className={`product-card ${selected?.id === product.id ? "active" : ""}`}
                      onClick={() => void loadDetail(product.id)}
                    >
                      <div className="product-card-media">
                        {product.cover_image_url ? (
                          <img
                            src={product.cover_image_url}
                            alt={product.title}
                          />
                        ) : (
                          <div className="placeholder">No image</div>
                        )}
                      </div>
                      <div className="product-card-body">
                        <div className="product-card-topline">
                          <span>{product.origin_type || "unknown"}</span>
                          <span>
                            {formatDate(
                              product.scraped_at || product.created_at,
                            )}
                          </span>
                        </div>
                        <h3>{product.title}</h3>
                        <p>{product.description}</p>
                        <div className="product-card-meta">
                          <span>{product.images_count} img</span>
                          <span>{product.prices_count} prezzi</span>
                          <span>{product.bundles_count || 0} bundle</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel" style={{ minHeight: 0 }}>
                <div className="panel-header">
                  <h3>Dettaglio prodotto</h3>
                  <span className="muted">{selected ? `#${selected.id}` : "Nessuna selezione"}</span>
                </div>
                {selected ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="kpi">
                      <span>Selezionato</span>
                      <strong>
                        #{selected.id} - {selected.title}
                      </strong>
                    </div>
                    <div className="kpi">
                      <span>Descrizione</span>
                      <strong>{selected.description}</strong>
                    </div>
                    <div className="kpi">
                      <span>Immagini / Prezzi</span>
                      <strong>
                        {selected.images.length} / {selected.prices.length}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Seleziona un prodotto per vedere i dettagli.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      {viewerOpen && selected && (
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
      )}
      <CreationModal
        open={creating}
        draft={newProductDraft}
        onClose={() => setCreating(false)}
        onChange={(patch) =>
          setNewProductDraft((d) => ({ ...(d || {}), ...patch }))
        }
        onCreate={createNewProduct}
        tags={tags}
      />
      <footer className="app-footer">Versione: {appVersion}</footer>
    </div>
  );
}

function CreationModal({
  open,
  draft,
  onClose,
  onChange,
  onCreate,
  tags,
}: {
  open: boolean;
  draft: Partial<ProductDetail>;
  onClose: () => void;
  onChange: (patch: Partial<ProductDetail>) => void;
  onCreate: () => void;
  tags: Tag[];
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

function StatCard({
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
