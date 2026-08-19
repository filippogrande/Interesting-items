export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatMoney(amount?: number | null, currency?: string | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
}

export function labelFromHost(host: string) {
  const normalizedHost = host.replace(/^www\./, "").toLowerCase();
  if (!normalizedHost) return "—";
  if (/vinted/.test(normalizedHost)) return "vinted";
  const parts = normalizedHost.split(".").filter(Boolean);
  if (parts.length >= 3) {
    const first = parts[0];
    const second = parts[1];
    if (
      /^[a-z]{2}$/.test(first) ||
      ["www", "m", "it", "en", "de", "fr", "es", "nl", "pl", "pt", "uk", "us"].includes(first)
    ) {
      return second + " " + first;
    }
  }
  return parts[0] || normalizedHost;
}

export function derivePlatformLabel(
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

export function makeEmptyPrice() {
  return { id: 0, amount: 0, currency: "EUR", platform: "", sold: false };
}

export function makeEmptySourceUrl() {
  return { id: 0, url: "", domain: "" };
}

export function buildTagLabel(tag: any, tagMap: Map<number, any>) {
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

export const TAG_KIND_LABELS: Record<string, string> = {
  taxonomy: "Taxonomy",
  store: "Store",
  project: "Project",
};

export const TAG_KIND_ORDER: string[] = ["taxonomy", "store", "project"];
