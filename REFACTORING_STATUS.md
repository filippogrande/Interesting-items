# Fix Docker Build - utils/format.ts export

## Commit bed9b2ce

Ripristinati gli export mancanti in `src/utils/format.ts`:

```typescript
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

export function labelFromHost(host: string) { ... }
export function derivePlatformLabel(price, source) { ... }
export function makeEmptyPrice() { ... }
export function makeEmptySourceUrl() { ... }
export function buildTagLabel(tag, tagMap) { ... }
export const TAG_KIND_LABELS = { ... };
export const TAG_KIND_ORDER = ["taxonomy", "store", "project"];
```

## Stato refactoring

- ProductCard.tsx ✓
- MergeView.tsx ✓
- ProductList.tsx ✓
- ProductDetail.tsx ✓
- types.ts ✓
- utils/format.ts ✓ (fix applicata)
