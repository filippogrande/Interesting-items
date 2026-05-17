import React, { useEffect, useMemo, useState } from "react";
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

function derivePlatformLabel(
  price: { platform?: string | null } | null | undefined,
  source?: { domain?: string | null; url?: string } | null | undefined,
) {
  if (price && price.platform) return price.platform;
  if (!source) return "—";
  const domain = source.domain || source.url || "";
  try {
    const u = domain.startsWith("http") ? new URL(domain) : new URL("http://" + domain);
    const host = u.hostname || domain;
    if (/vinted/i.test(host)) return "vinted";
    const parts = host.replace(/^www\./, "").split(".");
    return parts[0] || "—";
  } catch (e) {
    if (/vinted/i.test(domain)) return "vinted";
    return (domain || "—").split(".")[0] || "—";
  }
}

function collectWebsites(detail: ProductDetail | null) {
  if (!detail) return [] as string[];
  const set = new Set<string>();
  for (const s of detail.source_urls || []) {
    const host = (s.domain || s.url || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (host) set.add(host.toLowerCase());
  }
  for (const p of detail.prices || []) {
    const label = (p.platform || "").trim();
    if (label) set.add(label.toLowerCase());
  }
  // if empty, try derive from matching source_urls domains that contain known hosts (vinted)
  if (set.size === 0) {
    for (const s of detail.source_urls || []) {
      if (/vinted/i.test(s.url || s.domain || "")) set.add("vinted");
    }
  }
  return Array.from(set).map((s) => s);
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
  const [selectedTagId, setSelectedTagId] = useState<number | "">("");
  const [view, setView] = useState<"dashboard" | "tags">("dashboard");
  const [tagsStats, setTagsStats] = useState<{
    tags: Array<Tag & { count: number }>;
    untagged_count: number;
  } | null>(null);

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

  async function loadProducts(tagId?: number | "" | "untagged") {
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
        list = await fetchJson<ProductSummary[]>(
          `/api/dashboard/products?${params.toString()}`,
        );
      }
      setProducts(list);
      if (list.length > 0) {
        void loadDetail(list[0].id);
      } else {
        setSelected(null);
        setDraft(null);
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
    void loadProducts(selectedTagId as number | "" | "untagged");
  }, [selectedTagId]);

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
      setEditingTagIds([...editingTagIds, created.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione tag");
    }
  }

  const tagMap = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

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
      sources: products.reduce((sum, item) => sum + item.source_urls_count, 0),
      tags: tags.length,
    }),
    [products, tags],
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
        <StatCard label="Prodotti" value={stats.products} />
        <StatCard label="Immagini" value={stats.images} />
        <StatCard label="Prezzi" value={stats.prices} />
        <StatCard label="Source websites" value={stats.sources} />
        <StatCard
          label="Tag"
          value={stats.tags}
          onClick={() => {
            setView("tags");
            void loadTagsStats();
          }}
        />
      </section>

      <main className="layout">
        {view === "tags" ? (
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Tags</h2>
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
                    void loadTagsStats();
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
                  setView("dashboard");
                }}
              >
                Tutti i tag ({stats.products})
              </button>

              <button
                className="button"
                onClick={() => {
                  setSelectedTagId("untagged");
                  setView("dashboard");
                }}
              >
                Senza tag ({tagsStats?.untagged_count ?? 0})
              </button>

              {TAG_KIND_ORDER.map((kind) => {
                const group = (tagsStats?.tags || [])
                  .filter((t) => t.kind === kind)
                  .sort((a, b) => a.name.localeCompare(b.name));
                if (group.length === 0) return null;
                return (
                  <div key={kind} style={{ marginTop: 8 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#4a5568",
                        marginBottom: 6,
                      }}
                    >
                      {TAG_KIND_LABELS[kind]}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {group.map((t) => (
                        <button
                          key={t.id}
                          className="button"
                          onClick={() => {
                            setSelectedTagId(t.id);
                            setView("dashboard");
                          }}
                        >
                          {t.name} ({t.count})
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Elenco prodotti</h2>
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  className="search"
                  placeholder="Cerca per titolo, descrizione o origine"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  className="input"
                  value={selectedTagId}
                  onChange={(event) =>
                    setSelectedTagId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
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
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

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
                  className="button"
                  onClick={() => {
                    setEditing(true);
                    setDraft(selected);
                    setEditingTagIds(selected.tags.map((t) => t.id));
                  }}
                >
                  Modifica
                </button>
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
                  style={{ padding: "6px 10px", fontSize: 16 }}
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
                      // refresh dettagli
                      await loadDetail(selected.id);
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
                    <Kpi
                      label="Source websites"
                      value={(() => {
                        const sites = collectWebsites(selected);
                        return sites.length ? sites.join(", ") : "—";
                      })()}
                    />
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
                                      setEditingTagIds([
                                        ...editingTagIds,
                                        tag.id,
                                      ]);
                                    } else {
                                      setEditingTagIds(
                                        editingTagIds.filter(
                                          (id) => id !== tag.id,
                                        ),
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
                {selected.images.map((image) => (
                  <div key={image.id} className="gallery-item">
                    {image.url ? (
                      <a href={image.url} target="_blank" rel="noreferrer">
                        <img src={image.url} alt={selected.title} />
                      </a>
                    ) : (
                      <div className="placeholder">No image</div>
                    )}
                    {editing && draft && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          className="button tiny"
                          onClick={async () => {
                            // delete image
                            if (!confirm("Eliminare questa immagine?")) return;
                            try {
                              await fetch(`/api/images/${image.id}`, {
                                method: "DELETE",
                              });
                              await loadDetail(selected.id);
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Errore cancellazione immagine",
                              );
                            }
                          }}
                        >
                          Elimina
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!selected.images.length && (
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
                            <li key={price.id}>
                            <strong>
                              {formatMoney(price.amount, price.currency)}
                            </strong>
                            <span>{derivePlatformLabel(price, selected.source_urls[idx])}</span>
                            <small>{formatDate(price.added_at)}</small>
                            {selected.source_urls[idx] && (
                              <a
                                href={selected.source_urls[idx].url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {selected.source_urls[idx].domain ||
                                  selected.source_urls[idx].url}
                              </a>
                            )}
                          </li>
                        ))}
                      {/* extra source_urls (when there are more sources than prices) */}
                      {!editing &&
                        selected.source_urls.length > selected.prices.length &&
                        selected.source_urls
                          .slice(selected.prices.length)
                          .map((source) => (
                            <li key={source.id}>
                              <a href={source.url} target="_blank" rel="noreferrer">
                                {source.domain || source.url}
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
    </div>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
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
