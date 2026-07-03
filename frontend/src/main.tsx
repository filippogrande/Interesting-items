import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ProductSummary = {
  id: number;
  title: string;
  description: string;
  brand?: string | null;
  origin_type?: string | null;
  archived: boolean;
  scraped_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  images_count: number;
  prices_count: number;
  source_urls_count: number;
  source_links_count?: number;
  bundles_count?: number;
  cover_image_url?: string | null;
  latest_price?: number | null;
  latest_currency?: string | null;
  latest_platform?: string | null;
  latest_source_url?: string | null;
  tags_count: number;
};

type Tag = {
  id: number;
  name: string;
  slug?: string | null;
  kind: "taxonomy" | "store" | "project";
  parent_id?: number | null;
  tag_metadata?: string | null;
};

type SourceWebsite = {
  name: string;
  count: number;
};

type ProductDetail = ProductSummary & {
  images: Array<{
    id: number;
    filename: string;
    url?: string | null;
    size_bytes?: number | null;
    checksum?: string | null;
  }>;
  prices: Array<{
    id: number;
    amount: number;
    currency: string;
    platform?: string | null;
    added_at?: string | null;
    sold: boolean;
  }>;
  source_urls: Array<{
    id: number;
    url: string;
    domain?: string | null;
    added_at?: string | null;
  }>;
  tags: Tag[];
  bundles: Array<{
    id: number;
    title: string;
    amount: number;
    currency: string;
    source_url: string;
    source_domain?: string | null;
    notes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    product_ids: number[];
  }>;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(amount?: number | null, currency?: string | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
}

function labelFromHost(host: string) {
  const normalizedHost = host.replace(/^www\./, "").toLowerCase();
  if (!normalizedHost) return "—";
  if (/vinted/.test(normalizedHost)) return "vinted";
  const parts = normalizedHost.split(".").filter(Boolean);
  if (parts.length >= 3) {
    const first = parts[0];
    const second = parts[1];
    if (
      /^[a-z]{2}$/.test(first) ||
      [
        "www",
        "m",
        "it",
        "en",
        "de",
        "fr",
        "es",
        "nl",
        "pl",
        "pt",
        "uk",
        "us",
      ].includes(first)
    ) {
      return second || first || "—";
    }
  }
  return parts[0] || normalizedHost || "—";
}

function derivePlatformLabel(
  price: { platform?: string | null } | null | undefined,
  source?: { domain?: string | null; url?: string } | null | undefined,
) {
  if (price && price.platform) return price.platform;
  if (!source) return "—";
  const domain = source.domain || source.url || "";
  try {
    const u = domain.startsWith("http")
      ? new URL(domain)
      : new URL("http://" + domain);
    return labelFromHost(u.hostname || domain);
  } catch (e) {
    return labelFromHost(domain || "");
  }
}

function makeEmptyPrice() {
  return { id: 0, amount: 0, currency: "EUR", platform: "", sold: false };
}

function makeEmptySourceUrl() {
  return { id: 0, url: "", domain: "" };
}

function buildTagLabel(tag: Tag, tagMap: Map<number, Tag>) {
  const parts = [tag.name];
  let currentParentId = tag.parent_id;
  while (currentParentId) {
    const parent = tagMap.get(currentParentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currentParentId = parent.parent_id ?? null;
  }
  return `${tag.kind}: ${parts.join(" › ")}`;
}

const TAG_KIND_LABELS: Record<Tag["kind"], string> = {
  taxonomy: "Taxonomy",
  store: "Store",
  project: "Project",
};

const TAG_KIND_ORDER: Tag["kind"][] = ["taxonomy", "store", "project"];

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
        const params = new URLSearchParams({ limit: "100" });
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
      // refresh list and open detail
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
      // also update tags list (without counts)
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
      // compute ancestors from freshly loaded tags so parents are pinned when creating a tag
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

  // return ancestor ids (closest parent first)
  function getAncestorIds(tagId: number): number[] {
    const result: number[] = [];
    let current = tagMap.get(tagId);
    while (current && current.parent_id) {
      const pid = current.parent_id;
      if (!pid) break;
      // prepend so order is from root -> immediate parent
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
  const isTagsView = view === "tags";

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
            // clear all filters and show full dashboard
            resetFilters();
            setView("dashboard");
            // load all products without auto-selecting a detail
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
        {view === "merge" ? (
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
              <div className="panel" style={{ minHeight: 0 }}>
                <div className="panel-header">
                  <h3>Main</h3>
                  <span className="muted">Prodotto da mantenere</span>
                </div>
                <div className="product-list" style={{ marginBottom: 14 }}>
                  {filteredProducts.map((product) => (
                    <button
                      key={`merge-main-${product.id}`}
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
                    Seleziona il prodotto principale.
                  </div>
                )}
              </div>

              <div className="panel" style={{ minHeight: 0 }}>
                <div className="panel-header">
                  <h3>Da mergiare</h3>
                  <span className="muted">Prodotto che verrà eliminato</span>
                </div>
                <div className="product-list" style={{ marginBottom: 14 }}>
                  {filteredProducts
                    .filter((product) => product.id !== selected?.id)
                    .map((product) => (
                      <button
                        key={`merge-source-${product.id}`}
                        className={`product-card ${mergeCandidateDetail?.id === product.id ? "active" : ""}`}
                        onClick={() => void loadMergeCandidate(product.id)}
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
                {mergeCandidateDetail ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="kpi">
                      <span>Selezionato</span>
                      <strong>
                        #{mergeCandidateDetail.id} - {mergeCandidateDetail.title}
                      </strong>
                    </div>
                    <div className="kpi">
                      <span>Descrizione</span>
                      <strong>{mergeCandidateDetail.description}</strong>
                    </div>
                    <div className="kpi">
                      <span>Immagini / Prezzi</span>
                      <strong>
                        {mergeCandidateDetail.images.length} / {mergeCandidateDetail.prices.length}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Seleziona il prodotto da mergiare.
                  </div>
                )}
              </div>
            </div>

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
                    <div
                      key={field as string}
                      style={{ display: "grid", gap: 6 }}
                    >
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
                              [field]: selected
                                ? (selected as any)[field] || ""
                                : "",
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

              <div className="editing-panel">
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>
                  Immagini, prezzi e link da importare dalla destra
                </h4>
                {mergeCandidateDetail ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Immagini
                      </div>
                      <div className="gallery" style={{ margin: 0 }}>
                        {mergeCandidateDetail.images.map((image) => {
                          const checked = mergeSelectedImageIds.includes(
                            image.id,
                          );
                          return (
                            <label
                              key={`merge-image-${image.id}`}
                              className="gallery-item"
                              style={{
                                position: "relative",
                                display: "block",
                                cursor: "pointer",
                                border: checked
                                  ? "2px solid rgba(96,165,250,0.9)"
                                  : undefined,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setMergeSelectedImageIds((current) =>
                                    current.includes(image.id)
                                      ? current.filter((id) => id !== image.id)
                                      : [...current, image.id],
                                  )
                                }
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  left: 8,
                                  zIndex: 2,
                                }}
                              />
                              {image.url ? (
                                <img
                                  src={image.url}
                                  alt={mergeCandidateDetail.title}
                                />
                              ) : (
                                <div className="placeholder">No image</div>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Prezzi
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {mergeCandidateDetail.prices.map((price) => {
                          const checked = mergeSelectedPriceIds.includes(
                            price.id,
                          );
                          const relatedSource =
                            mergeCandidateDetail.source_urls[0] || null;
                          return (
                            <label
                              key={`merge-price-${price.id}`}
                              className={`tag-option ${checked ? "selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setMergeSelectedPriceIds((current) =>
                                    current.includes(price.id)
                                      ? current.filter((id) => id !== price.id)
                                      : [...current, price.id],
                                  )
                                }
                                style={{ marginTop: 2 }}
                              />
                              <div style={{ display: "grid", gap: 4 }}>
                                <strong>
                                  {formatMoney(price.amount, price.currency)}
                                </strong>
                                <span>
                                  {derivePlatformLabel(price, relatedSource)}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Link
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {mergeCandidateDetail.source_urls.map((source) => {
                          const checked = mergeSelectedSourceUrlIds.includes(
                            source.id,
                          );
                          return (
                            <label
                              key={`merge-source-${source.id}`}
                              className={`tag-option ${checked ? "selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setMergeSelectedSourceUrlIds((current) =>
                                    current.includes(source.id)
                                      ? current.filter((id) => id !== source.id)
                                      : [...current, source.id],
                                  )
                                }
                                style={{ marginTop: 2 }}
                              />
                              <div style={{ display: "grid", gap: 4 }}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {derivePlatformLabel(undefined, source)}
                                </a>
                                <small>{source.url}</small>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Seleziona il prodotto di destra per importare immagini,
                    prezzi e link.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                className="button secondary"
                onClick={() => setView("dashboard")}
              >
                Annulla
              </button>
              <button
                className="button primary"
                onClick={() => void commitMerge()}
                disabled={!selected || !mergeCandidateDetail}
              >
                Salva merge
              </button>
            </div>
          </section>
        ) : isTagsView ? (
          <section className="panel list-panel">
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
              <div className="panel" style={{ minHeight: 0 }}>
                <div className="panel-header">
                  <h3>Main</h3>
                  <span className="muted">Prodotto da mantenere</span>
                </div>
                <div className="product-list" style={{ marginBottom: 14 }}>
                  {filteredProducts.map((product) => (
                    <button
                      key={`merge-main-${product.id}`}
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
                    Seleziona il prodotto principale.
                  </div>
                )}
              </div>

              <div className="panel" style={{ minHeight: 0 }}>
                <div className="panel-header">
                  <h3>Da mergiare</h3>
                  <span className="muted">Prodotto che verrà eliminato</span>
                </div>
                <div className="product-list" style={{ marginBottom: 14 }}>
                  {filteredProducts
                    .filter((product) => product.id !== selected?.id)
                    .map((product) => (
                      <button
                        key={`merge-source-${product.id}`}
                        className={`product-card ${mergeCandidateDetail?.id === product.id ? "active" : ""}`}
                        onClick={() => void loadMergeCandidate(product.id)}
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
                {mergeCandidateDetail ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="kpi">
                      <span>Selezionato</span>
                      <strong>
                        #{mergeCandidateDetail.id} -{" "}
                        {mergeCandidateDetail.title}
                      </strong>
                    </div>
                    <div className="kpi">
                      <span>Descrizione</span>
                      <strong>{mergeCandidateDetail.description}</strong>
                    </div>
                    <div className="kpi">
                      <span>Immagini / Prezzi</span>
                      <strong>
                        {mergeCandidateDetail.images.length} /{" "}
                        {mergeCandidateDetail.prices.length}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Seleziona il prodotto da mergiare.
                  </div>
                )}
              </div>
            </div>

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
                    <div
                      key={field as string}
                      style={{ display: "grid", gap: 6 }}
                    >
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
                              [field]: selected
                                ? (selected as any)[field] || ""
                                : "",
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

              <div className="editing-panel">
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>
                  Immagini, prezzi e link da importare dalla destra
                </h4>
                {mergeCandidateDetail ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Immagini
                      </div>
                      <div className="gallery" style={{ margin: 0 }}>
                        {mergeCandidateDetail.images.map((image) => {
                          const checked = mergeSelectedImageIds.includes(
                            image.id,
                          );
                          return (
                            <label
                              key={`merge-image-${image.id}`}
                              className="gallery-item"
                              style={{
                                position: "relative",
                                display: "block",
                                cursor: "pointer",
                                border: checked
                                  ? "2px solid rgba(96,165,250,0.9)"
                                  : undefined,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setMergeSelectedImageIds((current) =>
                                    current.includes(image.id)
                                      ? current.filter((id) => id !== image.id)
                                      : [...current, image.id],
                                  )
                                }
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  left: 8,
                                  zIndex: 2,
                                }}
                              />
                              {image.url ? (
                                <img
                                  src={image.url}
                                  alt={mergeCandidateDetail.title}
                                />
                              ) : (
                                <div className="placeholder">No image</div>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Prezzi
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {mergeCandidateDetail.prices.map((price) => {
                          const checked = mergeSelectedPriceIds.includes(
                            price.id,
                          );
                          const relatedSource =
                            mergeCandidateDetail.source_urls.find(
                              (source) => source.id === price.id,
                            ) || mergeCandidateDetail.source_urls[0];
                          return (
                            <label
                              key={`merge-price-${price.id}`}
                              className={`tag-option ${checked ? "selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setMergeSelectedPriceIds((current) =>
                                    current.includes(price.id)
                                      ? current.filter((id) => id !== price.id)
                                      : [...current, price.id],
                                  )
                                }
                                style={{ marginTop: 2 }}
                              />
                              <div style={{ display: "grid", gap: 4 }}>
                                <strong>
                                  {formatMoney(price.amount, price.currency)}
                                </strong>
                                <span>
                                  {derivePlatformLabel(price, relatedSource)}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Link
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {mergeCandidateDetail.source_urls.map((source) => {
                          const checked = mergeSelectedSourceUrlIds.includes(
                            source.id,
                          );
                          return (
                            <label
                              key={`merge-source-${source.id}`}
                              className={`tag-option ${checked ? "selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setMergeSelectedSourceUrlIds((current) =>
                                    current.includes(source.id)
                                      ? current.filter((id) => id !== source.id)
                                      : [...current, source.id],
                                  )
                                }
                                style={{ marginTop: 2 }}
                              />
                              <div style={{ display: "grid", gap: 4 }}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {derivePlatformLabel(undefined, source)}
                                </a>
                                <small>{source.url}</small>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Seleziona il prodotto di destra per importare immagini,
                    prezzi e link.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                className="button secondary"
                onClick={() => setView("dashboard")}
              >
                Annulla
              </button>
              <button
                className="button primary"
                onClick={() => void commitMerge()}
                disabled={!selected || !mergeCandidateDetail}
              >
                Salva merge
              </button>
            </div>
          </section>
        ) : isTagsView ? (
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Tags</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="button secondary"
                  onClick={() => {
                    setView("dashboard");
                  }}
                >
                  Indietro
                </button>
                <button
                  className="button"
                  onClick={() => {
                    void loadTagsStats();
                  }}
                >
                  Aggiorna
                </button>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#cbd5e1",
                        textTransform: "uppercase",
                      }}
                    >
                      Seleziona un tag
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                      La selezione filtra la lista prodotti qui sotto e apre il dettaglio come nella homepage.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className={`button ${selectedTagId === "" ? "primary" : "secondary"}`}
                      onClick={() => {
                        setSelectedTagId("");
                        setSelectedSourceSite("");
                      }}
                    >
                      Tutti i tag ({stats.products})
                    </button>
                    <button
                      className={`button ${selectedTagId === "untagged" ? "primary" : "secondary"}`}
                      onClick={() => {
                        setSelectedTagId("untagged");
                        setSelectedSourceSite("");
                      }}
                    >
                      Senza tag ({tagsStats?.untagged_count ?? 0})
                    </button>
                  </div>
                </div>

                {TAG_KIND_ORDER.map((kind) => {
                  const group = (tagsStats?.tags || [])
                    .filter((t) => t.kind === kind)
                    .sort((a, b) => a.name.localeCompare(b.name));
                  if (group.length === 0) return null;
                  return (
                    <div key={kind} style={{ display: "grid", gap: 8 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#4a5568",
                        }}
                      >
                        {TAG_KIND_LABELS[kind]}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {group.map((tag) => {
                          const isSelected = selectedTagId === tag.id;
                          return (
                            <button
                              key={tag.id}
                              className={`tag-option ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                setSelectedTagId(tag.id);
                                setSelectedSourceSite("");
                              }}
                              style={{ textAlign: "left" }}
                            >
                              <div style={{ display: "grid", gap: 4, width: "100%" }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                  {tag.name}
                                </div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                  {tag.count} prodotti
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <input
                  className="search"
                  placeholder="Cerca nel filtro attivo"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  className="input"
                  value={selectedTagId}
                  onChange={(event) => {
                    setSelectedTagId(
                      event.target.value === "untagged"
                        ? "untagged"
                        : event.target.value
                          ? Number(event.target.value)
                          : "",
                    );
                    setSelectedSourceSite("");
                  }}
                >
                  <option value="">Tutti i tag</option>
                  <option value="untagged">Senza tag</option>
                  {TAG_KIND_ORDER.map((kind) =>
                    tagsByKind[kind].length > 0 ? (
                      <optgroup key={kind} label={`${TAG_KIND_LABELS[kind]}:`}>
                        {tagsByKind[kind].map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null,
                  )}
                </select>
                <div
                  style={{
                    marginTop: 4,
                    padding: excludeTagsExpanded ? 12 : "10px 12px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    display: "grid",
                    gap: excludeTagsExpanded ? 10 : 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setExcludeTagsExpanded((current) => !current)
                    }
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#cbd5e1",
                            textTransform: "uppercase",
                          }}
                        >
                          Escludi tag
                        </div>
                        {excludeTagIds.length > 0 && (
                          <span
                            className="badge muted"
                            style={{ padding: "4px 10px", fontSize: 11 }}
                          >
                            {excludeTagIds.length}
                          </span>
                        )}
                      </div>
                      {excludeTagsExpanded && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            marginTop: 4,
                          }}
                        >
                          Seleziona uno o più tag da togliere dai risultati.
                        </div>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      {excludeTagsExpanded && (
                        <button
                          className="button secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            clearExcludeTags();
                          }}
                          disabled={excludeTagIds.length === 0}
                          style={{ padding: "8px 12px" }}
                        >
                          Azzera
                        </button>
                      )}
                      <span style={{ color: "#94a3b8", fontSize: 14 }}>
                        {excludeTagsExpanded ? "▴" : "▾"}
                      </span>
                    </div>
                  </div>

                  {excludeTagsExpanded && (
                    <>
                      {excludeTagIds.length > 0 && (
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          {excludeTagIds.map((tagId) => {
                            const tag = tagMap.get(tagId);
                            if (!tag) return null;
                            return (
                              <div
                                key={`exclude-chip-${tagId}`}
                                className="tag-pill"
                              >
                                <span style={{ fontSize: 14, fontWeight: 500 }}>
                                  {tag.name}
                                </span>
                                <button
                                  className="button tiny danger"
                                  onClick={() => toggleExcludeTag(tagId)}
                                  style={{ padding: "0px 6px", fontSize: 12 }}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          maxHeight: "260px",
                          overflowY: "auto",
                          paddingRight: 6,
                        }}
                      >
                        {TAG_KIND_ORDER.map((kind) => {
                          const group = tagsByKind[kind]
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name));
                          if (group.length === 0) return null;
                          return (
                            <div
                              key={`exclude-${kind}`}
                              style={{ display: "grid", gap: 6 }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  color: "#4a5568",
                                }}
                              >
                                {TAG_KIND_LABELS[kind]}
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fill, minmax(180px, 1fr))",
                                  gap: 8,
                                }}
                              >
                                {group.map((tag) => {
                                  const isSelected = excludeTagIds.includes(
                                    tag.id,
                                  );
                                  return (
                                    <label
                                      key={`exclude-tag-${tag.id}`}
                                      className={`tag-option ${isSelected ? "selected" : ""}`}
                                      style={{ cursor: "pointer" }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                          toggleExcludeTag(tag.id)
                                        }
                                        style={{ marginTop: 2 }}
                                      />
                                      <div
                                        style={{
                                          fontSize: 13,
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        <div style={{ fontWeight: 600 }}>
                                          {tag.name}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {selectedSourceSite && (
                <div className="badge muted" style={{ marginBottom: 10 }}>
                  Filtro sito: {selectedSourceSite}
                </div>
              )}

              <div className="product-list">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    className={`product-card ${selected?.id === product.id ? "active" : ""}`}
                    onClick={() => void loadDetail(product.id)}
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
                        <span>
                          {formatMoney(
                            product.latest_price,
                            product.latest_currency,
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}

                {!loadingList && filteredProducts.length === 0 && (
                  <div className="empty-state">Nessun prodotto trovato.</div>
                )}
              </div>
            </div>
          </section>
        ) : view === "sources" ? (
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Source websites</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="button secondary"
                  onClick={() => {
                    setView("dashboard");
                  }}
                >
                  Indietro
                </button>
                <button
                  className="button"
                  onClick={() => {
                    void loadSourceWebsitesStats();
                  }}
                >
                  Aggiorna
                </button>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div style={{ display: "grid", gap: 8 }}>
              <button
                className="button"
                onClick={() => {
                  setSelectedTagId("");
                  setSelectedSourceSite("");
                  setView("dashboard");
                }}
              >
                Tutti i siti ({stats.products})
              </button>

              {(sourceWebsitesStats?.websites || []).map((site) => (
                <button
                  key={site.name}
                  className="button"
                  onClick={() => {
                    setSelectedTagId("");
                    setSelectedSourceSite(site.name);
                    setView("dashboard");
                  }}
                >
                  {site.name} ({site.count})
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Elenco prodotti</h2>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className="button secondary"
                    onClick={() => setCreating(true)}
                  >
                    + Nuovo prodotto
                  </button>
                </div>
                <input
                  className="search"
                  placeholder="Cerca per titolo, descrizione o origine"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  className="input"
                  value={selectedTagId}
                  onChange={(event) => {
                    setSelectedTagId(
                      event.target.value ? Number(event.target.value) : "",
                    );
                    setSelectedSourceSite("");
                  }}
                >
                  <option value="">Tutti i tag</option>
                  {TAG_KIND_ORDER.map((kind) =>
                    tagsByKind[kind].length > 0 ? (
                      <optgroup key={kind} label={`${TAG_KIND_LABELS[kind]}:`}>
                        {tagsByKind[kind].map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null,
                  )}
                </select>
                <div
                  style={{
                    marginTop: 4,
                    padding: excludeTagsExpanded ? 12 : "10px 12px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    display: "grid",
                    gap: excludeTagsExpanded ? 10 : 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setExcludeTagsExpanded((current) => !current)
                    }
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#cbd5e1",
                            textTransform: "uppercase",
                          }}
                        >
                          Escludi tag
                        </div>
                        {excludeTagIds.length > 0 && (
                          <span
                            className="badge muted"
                            style={{ padding: "4px 10px", fontSize: 11 }}
                          >
                            {excludeTagIds.length}
                          </span>
                        )}
                      </div>
                      {excludeTagsExpanded && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            marginTop: 4,
                          }}
                        >
                          Seleziona uno o più tag da togliere dai risultati.
                        </div>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      {excludeTagsExpanded && (
                        <button
                          className="button secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            clearExcludeTags();
                          }}
                          disabled={excludeTagIds.length === 0}
                          style={{ padding: "8px 12px" }}
                        >
                          Azzera
                        </button>
                      )}
                      <span style={{ color: "#94a3b8", fontSize: 14 }}>
                        {excludeTagsExpanded ? "▴" : "▾"}
                      </span>
                    </div>
                  </div>

                  {excludeTagsExpanded && (
                    <>
                      {excludeTagIds.length > 0 && (
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          {excludeTagIds.map((tagId) => {
                            const tag = tagMap.get(tagId);
                            if (!tag) return null;
                            return (
                              <div
                                key={`exclude-chip-${tagId}`}
                                className="tag-pill"
                              >
                                <span style={{ fontSize: 14, fontWeight: 500 }}>
                                  {tag.name}
                                </span>
                                <button
                                  className="button tiny danger"
                                  onClick={() => toggleExcludeTag(tagId)}
                                  style={{ padding: "0px 6px", fontSize: 12 }}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          maxHeight: "260px",
                          overflowY: "auto",
                          paddingRight: 6,
                        }}
                      >
                        {TAG_KIND_ORDER.map((kind) => {
                          const group = tagsByKind[kind]
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name));
                          if (group.length === 0) return null;
                          return (
                            <div
                              key={`exclude-${kind}`}
                              style={{ display: "grid", gap: 6 }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  color: "#4a5568",
                                }}
                              >
                                {TAG_KIND_LABELS[kind]}
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fill, minmax(180px, 1fr))",
                                  gap: 8,
                                }}
                              >
                                {group.map((tag) => {
                                  const isSelected = excludeTagIds.includes(
                                    tag.id,
                                  );
                                  return (
                                    <label
                                      key={`exclude-tag-${tag.id}`}
                                      className={`tag-option ${isSelected ? "selected" : ""}`}
                                      style={{ cursor: "pointer" }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                          toggleExcludeTag(tag.id)
                                        }
                                        style={{ marginTop: 2 }}
                                      />
                                      <div
                                        style={{
                                          fontSize: 13,
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        <div style={{ fontWeight: 600 }}>
                                          {tag.name}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            {selectedSourceSite && (
              <div className="badge muted" style={{ marginBottom: 10 }}>
                Filtro sito: {selectedSourceSite}
              </div>
            )}

            <div className="product-list">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  className={`product-card ${selected?.id === product.id ? "active" : ""}`}
                  onClick={() => void loadDetail(product.id)}
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
                      <span>
                        {formatMoney(
                          product.latest_price,
                          product.latest_currency,
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              ))}

              {!loadingList && filteredProducts.length === 0 && (
                <div className="empty-state">Nessun prodotto trovato.</div>
              )}
            </div>
          </section>
        )}

        <section className="panel detail-panel">
          <div className="panel-header">
            <h2>Dettaglio prodotto</h2>
            {loadingDetail && <span className="muted">Aggiornamento...</span>}
            {selected && !editing && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="button secondary"
                  onClick={() => void duplicateSelectedProduct()}
                >
                  Duplica
                </button>
                <button
                  className="button"
                  onClick={() => {
                    setEditing(true);
                    setDraft(selected);
                    setEditingTagIds(selected.tags.map((t) => t.id));
                    setDraftPendingUploads([]);
                    setDraftDeletedImageIds([]);
                  }}
                >
                  Modifica
                </button>
                {/* initialize image edit buffers */}
                <script
                  /* noop placeholder removed; initialize buffers directly below */
                  dangerouslySetInnerHTML={{ __html: "" }}
                />
                <button
                  title="Elimina prodotto"
                  className="button danger"
                  onClick={async () => {
                    if (!selected) return;
                    if (!confirm("Eliminare definitivamente questo prodotto?"))
                      return;
                    try {
                      const resp = await fetch(`/api/products/${selected.id}`, {
                        method: "DELETE",
                      });
                      if (!resp.ok && resp.status !== 204) {
                        throw new Error(`HTTP ${resp.status}`);
                      }
                      // refresh lista e dettagli
                      await loadProducts(
                        selectedTagId as number | "" | "untagged",
                        selectedSourceSite,
                      );
                      setSelected(null);
                      setDraft(null);
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Errore eliminazione prodotto",
                      );
                    }
                  }}
                  style={{ padding: "12px 18px", fontSize: 16 }}
                >
                  🗑️
                </button>
              </div>
            )}
            {editing && (
              <div>
                <button
                  className="button primary"
                  onClick={async () => {
                    if (!draft || !selected) return;
                    try {
                      // salva product
                      await fetch(`/api/products/${selected.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: draft.title,
                          description: draft.description,
                          brand: draft.brand,
                          archived: draft.archived,
                        }),
                      });

                      // sincronizza tags
                      await fetch(`/api/products/${selected.id}/tags`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tag_ids: editingTagIds }),
                      });

                      // sincronizza prices
                      for (const [index, p] of draft.prices.entries()) {
                        const source = draft.source_urls[index];
                        const isEmptyRow =
                          p.id === 0 &&
                          p.amount === 0 &&
                          !p.platform &&
                          !(source?.url || "").trim();
                        if (isEmptyRow) continue;
                        if (p.id && p.id > 0) {
                          await fetch(`/api/prices/${p.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(p),
                          });
                        } else {
                          await fetch(`/api/prices`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ...p,
                              product_id: selected.id,
                            }),
                          });
                        }
                      }

                      // sincronizza source_urls
                      for (const s of draft.source_urls) {
                        if (s.id === 0 && !(s.url || "").trim()) continue;
                        if (s.id && s.id > 0) {
                          await fetch(`/api/sourceurls/${s.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(s),
                          });
                        } else {
                          await fetch(`/api/sourceurls`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ...s,
                              product_id: selected.id,
                            }),
                          });
                        }
                      }

                      // per semplicità non gestiamo immagini complesse qui (solo delete se rimosse)
                      // gestisci immagini modificate in edit mode: cancellazioni e upload in attesa
                      if (draftDeletedImageIds.length > 0) {
                        for (const imgId of draftDeletedImageIds) {
                          try {
                            await fetch(`/api/images/${imgId}`, {
                              method: "DELETE",
                            });
                          } catch (e) {
                            console.warn(
                              "Errore eliminazione immagine durante salvataggio",
                              imgId,
                              e,
                            );
                          }
                        }
                      }
                      if (draftPendingUploads.length > 0) {
                        for (const file of draftPendingUploads) {
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch(
                              `/api/products/${selected.id}/images/upload`,
                              { method: "POST", body: fd },
                            );
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                          } catch (e) {
                            console.warn(
                              "Errore upload immagine durante salvataggio",
                              e,
                            );
                          }
                        }
                      }
                      // reset buffers locali immagine
                      setDraftPendingUploads([]);
                      setDraftDeletedImageIds([]);

                      // refresh dettagli
                      // refresh lista a sinistra senza cambiare automaticamente la selezione
                      await loadProducts(
                        selectedTagId as number | "" | "untagged",
                        selectedSourceSite,
                        excludeTagIds,
                        true,
                      );

                      // ricarica dettaglio salvato e deseleziona se non corrisponde più al filtro
                      await loadDetail(selected.id);
                      const saved = selected; // current selected after loadDetail
                      if (saved) {
                        const matchesFilter =
                          selectedTagId === ""
                            ? true
                            : selectedTagId === "untagged"
                              ? saved.tags.length === 0
                              : saved.tags.some(
                                  (t) => t.id === (selectedTagId as number),
                                );
                        if (!matchesFilter) {
                          setSelected(null);
                          setDraft(null);
                        }
                      }
                    } catch (err) {
                      console.error(err);
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Errore salvataggio",
                      );
                    } finally {
                      setEditing(false);
                      setDraft(null);
                      setDraftPendingUploads([]);
                      setDraftDeletedImageIds([]);
                    }
                  }}
                >
                  Salva
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                    setDraftPendingUploads([]);
                    setDraftDeletedImageIds([]);
                  }}
                >
                  Annulla
                </button>
              </div>
            )}
          </div>

          {selected ? (
            <>
              <div className="detail-hero">
                <div className="detail-title">
                  <span className="badge muted">#{selected.id}</span>
                  {editing && draft ? (
                    <div>
                      <input
                        className="input"
                        value={draft.title}
                        onChange={(e) =>
                          setDraft({ ...draft, title: e.target.value })
                        }
                      />
                      <textarea
                        className="textarea"
                        value={draft.description}
                        onChange={(e) =>
                          setDraft({ ...draft, description: e.target.value })
                        }
                      />
                      <input
                        className="input"
                        value={draft.brand || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, brand: e.target.value })
                        }
                        placeholder="brand"
                      />
                      <label style={{ display: "block", marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={draft.archived}
                          onChange={(e) =>
                            setDraft({ ...draft, archived: e.target.checked })
                          }
                        />{" "}
                        Archiviato
                      </label>
                    </div>
                  ) : (
                    <>
                      <h3>{selected.title}</h3>
                      <p>{selected.description}</p>
                    </>
                  )}
                </div>
                <div className="detail-kpis">
                  <Kpi label="Origine" value={selected.origin_type || "—"} />
                  <Kpi
                    label="Prezzo"
                    value={formatMoney(
                      selected.latest_price,
                      selected.latest_currency,
                    )}
                  />
                  {/* Source websites rimossa dal dettaglio prodotto per richiesta */}
                  <Kpi label="Creato" value={formatDate(selected.created_at)} />
                  <Kpi
                    label="Scansionato"
                    value={formatDate(selected.scraped_at)}
                  />
                </div>
              </div>

              {(selected.tags.length > 0 || !editing) && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ marginBottom: 8 }}>Tag</h4>
                  <div
                    className="tag-row"
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {selected.tags.map((tag) => (
                      <div key={tag.id} className="tag-pill">
                        <span style={{ fontSize: "14px", fontWeight: 500 }}>
                          {tag.name}
                        </span>
                        <button
                          className="button tiny danger"
                          onClick={() =>
                            toggleProductTag(selected.id, tag.id, false)
                          }
                          style={{ padding: "0px 4px", fontSize: "12px" }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {!editing && (
                      <button
                        className="button tiny"
                        onClick={() => {
                          setEditing(true);
                          setDraft(selected);
                          setEditingTagIds(selected.tags.map((t) => t.id));
                        }}
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                      >
                        + aggiungi tag
                      </button>
                    )}
                  </div>
                </div>
              )}

              {editing && (
                <div className="editing-panel">
                  <h4 style={{ marginTop: 0, marginBottom: 12 }}>
                    Aggiungi tag
                  </h4>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginBottom: 12,
                    }}
                  >
                    (I parent si aggiungono automaticamente)
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        className="input"
                        placeholder="Nome nuovo tag"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <select
                        value={newTagKind}
                        onChange={(e) =>
                          setNewTagKind(e.target.value as Tag["kind"])
                        }
                        className="input"
                        style={{ width: 150 }}
                      >
                        <option value="taxonomy">taxonomy</option>
                        <option value="store">store</option>
                        <option value="project">project</option>
                      </select>
                      <select
                        value={newTagParentId}
                        onChange={(e) =>
                          setNewTagParentId(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                        className="input"
                        style={{ width: 180 }}
                      >
                        <option value="">Nessun parent</option>
                        {TAG_KIND_ORDER.map((kind) =>
                          tagsByKind[kind].length > 0 ? (
                            <optgroup
                              key={kind}
                              label={`${TAG_KIND_LABELS[kind]}:`}
                            >
                              {tagsByKind[kind].map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                          ) : null,
                        )}
                      </select>
                      <button className="button primary" onClick={createTag}>
                        Crea
                      </button>
                    </div>
                    {tags.length === 0 ? (
                      <p style={{ gridColumn: "1 / -1" }}>
                        Nessun tag disponibile
                      </p>
                    ) : (
                      TAG_KIND_ORDER.flatMap((kind) => {
                        if (tagsByKind[kind].length === 0) return [];
                        return [
                          <div
                            key={`${kind}-header`}
                            style={{
                              gridColumn: "1 / -1",
                              fontSize: "12px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              color: "#4a5568",
                              marginTop: 6,
                            }}
                          >
                            {TAG_KIND_LABELS[kind]}
                          </div>,
                          ...tagsByKind[kind].map((tag) => {
                            const isSelected = editingTagIds.includes(tag.id);
                            return (
                              <label
                                key={tag.id}
                                className={`tag-option ${isSelected ? "selected" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditingTagIds((prev) => {
                                        const ancestors = getAncestorIds(
                                          tag.id,
                                        );
                                        const merged = new Set<number>([
                                          ...prev,
                                          ...ancestors,
                                          tag.id,
                                        ]);
                                        return Array.from(merged);
                                      });
                                    } else {
                                      setEditingTagIds((prev) =>
                                        prev.filter((id) => id !== tag.id),
                                      );
                                    }
                                  }}
                                  style={{ marginTop: 2 }}
                                />
                                <div
                                  style={{
                                    fontSize: "13px",
                                    lineHeight: "1.3",
                                  }}
                                >
                                  <div style={{ fontWeight: 600 }}>
                                    {tag.name}
                                  </div>
                                </div>
                              </label>
                            );
                          }),
                        ];
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="gallery">
                {(editing && draft ? draft.images : selected.images).map(
                  (image) => {
                    const marked = draftDeletedImageIds.includes(image.id);
                    return (
                      <div
                        key={image.id}
                        className="gallery-item"
                        style={{
                          position: "relative",
                          opacity: marked ? 0.4 : 1,
                        }}
                      >
                        {editing && (
                          <button
                            className={`button tiny ${marked ? "" : "danger"}`}
                            onClick={() => {
                              // toggle mark for deletion when editing
                              void deleteProductImage(image.id).catch((err) => {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Errore cancellazione immagine",
                                );
                              });
                            }}
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              zIndex: 2,
                              padding: "2px 6px",
                              lineHeight: 1,
                            }}
                            aria-label={
                              marked
                                ? "Annulla eliminazione immagine"
                                : "Elimina immagine"
                            }
                            title={
                              marked
                                ? "Annulla eliminazione immagine"
                                : "Elimina immagine"
                            }
                          >
                            {marked ? "↺" : "×"}
                          </button>
                        )}
                        {image.url ? (
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              const idx = (
                                editing && draft
                                  ? draft.images
                                  : selected.images
                              ).findIndex((i) => i.id === image.id);
                              setViewerIndex(idx >= 0 ? idx : 0);
                              setViewerOpen(true);
                            }}
                          >
                            <img src={image.url} alt={selected?.title} />
                          </a>
                        ) : (
                          <div className="placeholder">No image</div>
                        )}
                        {marked && editing && (
                          <div
                            style={{
                              position: "absolute",
                              left: 8,
                              bottom: 8,
                              background: "rgba(255,255,255,0.06)",
                              padding: "2px 6px",
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            Marked for deletion
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
                {/* previews for pending uploads while editing */}
                {editing &&
                  draftPendingUploads.map((file, idx) => {
                    const url = URL.createObjectURL(file);
                    return (
                      <div
                        key={`pending-${idx}`}
                        className="gallery-item"
                        style={{ position: "relative" }}
                      >
                        <button
                          className="button tiny"
                          onClick={() =>
                            setDraftPendingUploads((cur) =>
                              cur.filter((_, i) => i !== idx),
                            )
                          }
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            zIndex: 2,
                            padding: "2px 6px",
                            lineHeight: 1,
                          }}
                          aria-label="Rimuovi immagine in attesa"
                          title="Rimuovi immagine in attesa"
                        >
                          ×
                        </button>
                        <img src={url} alt={`pending-${idx}`} />
                        <div
                          style={{
                            position: "absolute",
                            left: 8,
                            bottom: 8,
                            background: "rgba(255,255,255,0.06)",
                            padding: "2px 6px",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          In attesa di salvataggio
                        </div>
                      </div>
                    );
                  })}
                {editing && (
                  <div
                    className="gallery-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      ref={imageUploadRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        void uploadProductImage(file).catch((err) => {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Errore upload immagine",
                          );
                        });
                      }}
                    />
                    <button
                      className="button"
                      onClick={() => imageUploadRef.current?.click()}
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 34,
                      }}
                    >
                      +
                    </button>
                  </div>
                )}
                {!selected.images.length && !editing && (
                  <div className="empty-state">
                    Nessuna immagine disponibile.
                  </div>
                )}
              </div>

              <div className="two-columns">
                <div style={{ gridColumn: "1 / -1" }}>
                  <h4>Prezzi e link</h4>
                  <ul className="info-list prices-grid">
                    {editing && draft
                      ? Array.from({
                          length: Math.max(
                            draft.prices.length,
                            draft.source_urls.length,
                          ),
                        }).map((_, idx) => {
                          const currentPrice = draft.prices[idx] ?? null;
                          const currentSource = draft.source_urls[idx] ?? null;

                          return (
                            <li key={`pair-${idx}`} className="editing-row">
                              <div
                                style={{
                                  display: "grid",
                                  gap: 8,
                                  width: "100%",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <input
                                    type="text"
                                    placeholder="0,00"
                                    value={String(currentPrice?.amount ?? 0)}
                                    onChange={(e) => {
                                      const normalized = e.target.value
                                        .trim()
                                        .replace(/,/g, ".");
                                      const amount =
                                        normalized === ""
                                          ? 0
                                          : Number.parseFloat(normalized);
                                      if (Number.isNaN(amount)) return;
                                      const copy = { ...draft };
                                      copy.prices[idx] = {
                                        ...(currentPrice ?? makeEmptyPrice()),
                                        amount,
                                      };
                                      setDraft(copy);
                                    }}
                                    className="input"
                                    style={{ width: 110 }}
                                  />
                                  <input
                                    value={currentPrice?.currency ?? "EUR"}
                                    onChange={(e) => {
                                      const copy = { ...draft };
                                      copy.prices[idx] = {
                                        ...(currentPrice ?? makeEmptyPrice()),
                                        currency: e.target.value,
                                      };
                                      setDraft(copy);
                                    }}
                                    className="input"
                                    style={{ width: 80 }}
                                  />
                                  <input
                                    value={currentPrice?.platform ?? ""}
                                    onChange={(e) => {
                                      const copy = { ...draft };
                                      copy.prices[idx] = {
                                        ...(currentPrice ?? makeEmptyPrice()),
                                        platform: e.target.value,
                                      };
                                      setDraft(copy);
                                    }}
                                    placeholder="piattaforma"
                                    className="input"
                                    style={{ flex: 1, minWidth: 140 }}
                                  />
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <input
                                    value={currentSource?.url ?? ""}
                                    onChange={(e) => {
                                      const copy = { ...draft };
                                      copy.source_urls[idx] = {
                                        ...(currentSource ??
                                          makeEmptySourceUrl()),
                                        url: e.target.value,
                                      };
                                      setDraft(copy);
                                    }}
                                    placeholder="link annuncio"
                                    className="input"
                                    style={{ flex: 1, minWidth: 240 }}
                                  />
                                  <button
                                    className="button tiny danger"
                                    onClick={async () => {
                                      const priceToDelete = draft.prices[idx];
                                      const sourceToDelete =
                                        draft.source_urls[idx];
                                      if (
                                        priceToDelete?.id &&
                                        priceToDelete.id > 0
                                      ) {
                                        if (!confirm("Eliminare questa riga?"))
                                          return;
                                        try {
                                          await fetch(
                                            `/api/prices/${priceToDelete.id}`,
                                            { method: "DELETE" },
                                          );
                                          if (
                                            sourceToDelete?.id &&
                                            sourceToDelete.id > 0
                                          ) {
                                            await fetch(
                                              `/api/sourceurls/${sourceToDelete.id}`,
                                              { method: "DELETE" },
                                            );
                                          }
                                          await loadDetail(selected.id);
                                        } catch (err) {
                                          setError(
                                            err instanceof Error
                                              ? err.message
                                              : "Errore eliminazione riga",
                                          );
                                        }
                                      } else if (
                                        sourceToDelete?.id &&
                                        sourceToDelete.id > 0
                                      ) {
                                        if (!confirm("Eliminare questa riga?"))
                                          return;
                                        try {
                                          await fetch(
                                            `/api/sourceurls/${sourceToDelete.id}`,
                                            { method: "DELETE" },
                                          );
                                          await loadDetail(selected.id);
                                        } catch (err) {
                                          setError(
                                            err instanceof Error
                                              ? err.message
                                              : "Errore eliminazione riga",
                                          );
                                        }
                                      } else {
                                        const copy = { ...draft };
                                        copy.prices = copy.prices.filter(
                                          (_, i) => i !== idx,
                                        );
                                        copy.source_urls =
                                          copy.source_urls.filter(
                                            (_, i) => i !== idx,
                                          );
                                        setDraft(copy);
                                      }
                                    }}
                                  >
                                    Elimina
                                  </button>
                                </div>
                              </div>
                            </li>
                          );
                        })
                      : selected.prices.map((price, idx) => (
                          <li
                            key={price.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <div>
                                <strong>
                                  {formatMoney(price.amount, price.currency)}
                                </strong>
                                <div style={{ fontSize: 12 }}>
                                  {derivePlatformLabel(
                                    price,
                                    selected.source_urls[idx],
                                  )}
                                </div>
                                <small>{formatDate(price.added_at)}</small>
                              </div>
                              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                                {selected.source_urls[idx] && (
                                  <div>
                                    <a href={selected.source_urls[idx].url} target="_blank" rel="noreferrer">
                                      {derivePlatformLabel(undefined, selected.source_urls[idx])}
                                    </a>
                                    <div>
                                      <small>{formatDate(selected.source_urls[idx].added_at)}</small>
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <button className="button tiny" onClick={() => void createBundleFromPrice(price, idx)}>
                                    Trasforma in bundle
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                    {/* extra source_urls (when there are more sources than prices) */}
                    {!editing &&
                      selected.source_urls.length > selected.prices.length &&
                      selected.source_urls
                        .slice(selected.prices.length)
                        .map((source) => (
                          <li key={source.id}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {derivePlatformLabel(undefined, source)}
                            </a>
                            <small>{formatDate(source.added_at)}</small>
                          </li>
                        ))}

                    {(selected || editing) && (
                      <li className={editing ? "editing-row" : undefined}>
                        <button className="button" onClick={appendEditablePair}>
                          +
                        </button>
                      </li>
                    )}
                  </ul>

                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <h4 style={{ margin: 0 }}>Bundle</h4>
                      <button
                        className="button secondary"
                        onClick={() =>
                          setBundleCreatorOpen((current) => !current)
                        }
                      >
                        {bundleCreatorOpen
                          ? "Chiudi crea bundle"
                          : "+ Crea bundle"}
                      </button>
                    </div>

                    {selected.bundles.length > 0 ? (
                      <div
                        style={{ display: "grid", gap: 10, marginBottom: 12 }}
                      >
                        {selected.bundles.map((bundle) => (
                          <div
                            key={bundle.id}
                            style={{
                              padding: 12,
                              borderRadius: 16,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <strong>{bundle.title}</strong>
                              <span className="badge muted">
                                {formatMoney(bundle.amount, bundle.currency)}
                              </span>
                            </div>
                            <div
                              style={{ marginTop: 6, display: "grid", gap: 6 }}
                            >
                              <a
                                href={bundle.source_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {bundle.source_domain || bundle.source_url}
                              </a>
                              <small style={{ color: "#94a3b8" }}>
                                {bundle.product_ids.length} prodotti nel bundle
                              </small>
                              {bundle.notes && (
                                <small style={{ color: "#94a3b8" }}>
                                  {bundle.notes}
                                </small>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state" style={{ marginBottom: 12 }}>
                        Nessun bundle collegato.
                      </div>
                    )}

                    {bundleCreatorOpen && (
                      <div
                        className="editing-panel"
                        style={{ marginBottom: 0 }}
                      >
                        <div style={{ display: "grid", gap: 10 }}>
                          <input
                            className="input"
                            placeholder="Titolo bundle (facoltativo)"
                            value={bundleDraft.title}
                            onChange={(e) =>
                              setBundleDraft((current) => ({
                                ...current,
                                title: e.target.value,
                              }))
                            }
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              className="input"
                              placeholder="Prezzo bundle"
                              value={bundleDraft.amount}
                              onChange={(e) =>
                                setBundleDraft((current) => ({
                                  ...current,
                                  amount: e.target.value,
                                }))
                              }
                              style={{ width: 140 }}
                            />
                            <input
                              className="input"
                              placeholder="EUR"
                              value={bundleDraft.currency}
                              onChange={(e) =>
                                setBundleDraft((current) => ({
                                  ...current,
                                  currency: e.target.value,
                                }))
                              }
                              style={{ width: 100 }}
                            />
                          </div>
                          <input
                            className="input"
                            placeholder="Link bundle"
                            value={bundleDraft.sourceUrl}
                            onChange={(e) =>
                              setBundleDraft((current) => ({
                                ...current,
                                sourceUrl: e.target.value,
                              }))
                            }
                          />
                          <textarea
                            className="textarea"
                            placeholder="Note facoltative"
                            value={bundleDraft.notes}
                            onChange={(e) =>
                              setBundleDraft((current) => ({
                                ...current,
                                notes: e.target.value,
                              }))
                            }
                          />

                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                              maxHeight: 260,
                              overflowY: "auto",
                              paddingRight: 6,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                textTransform: "uppercase",
                                color: "#94a3b8",
                                fontWeight: 700,
                              }}
                            >
                              Prodotti nel bundle
                            </div>
                            {products.map((product) => {
                              const checked = bundleDraft.productIds.includes(
                                product.id,
                              );
                              return (
                                <label
                                  key={`bundle-product-${product.id}`}
                                  className={`tag-option ${checked ? "selected" : ""}`}
                                  style={{ cursor: "pointer" }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setBundleDraft((current) => ({
                                        ...current,
                                        productIds: checked
                                          ? current.productIds.filter(
                                              (id) => id !== product.id,
                                            )
                                          : Array.from(
                                              new Set([
                                                ...current.productIds,
                                                product.id,
                                              ]),
                                            ),
                                      }));
                                    }}
                                    style={{ marginTop: 2 }}
                                  />
                                  <div
                                    style={{ fontSize: 13, lineHeight: 1.3 }}
                                  >
                                    <div style={{ fontWeight: 600 }}>
                                      #{product.id} - {product.title}
                                    </div>
                                    <div style={{ color: "#94a3b8" }}>
                                      {product.origin_type || "unknown"}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="button primary"
                              onClick={() => void createBundle()}
                            >
                              Crea bundle
                            </button>
                            <button
                              className="button secondary"
                              onClick={() =>
                                setBundleDraft((current) => ({
                                  ...current,
                                  productIds: selected ? [selected.id] : [],
                                }))
                              }
                            >
                              Reset prodotti
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Seleziona un prodotto per vedere i dettagli.
            </div>
          )}
        </section>
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

// render creation modal near root so it overlays whole app
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
// render modal by mounting another root-level component via portal-like insertion
// We attach CreationModal by enhancing App render with globals: simple approach - re-render within App
