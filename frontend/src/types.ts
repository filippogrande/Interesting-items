export type ProductSummary = {};

export type Tag = {
  id: number;
  name: string;
  slug: string;
  kind: "taxonomy" | "store" | "project";
  parent_id?: number | null;
  tag_metadata?: any;
};

export type SourceWebsite = {
  name: string;
  count: number;
};

export type ProductDetail = ProductSummary & {
  id: number;
  title: string;
  description: string;
  brand?: string | null;
  origin_type?: string | null;
  archived: boolean;
  scraped_at?: string | null;
  created_at?: string | null;
  cover_image_url?: string | null;
  images_count?: number;
  prices_count?: number;
  bundles_count?: number;
  latest_price?: number | null;
  latest_currency?: string | null;
  images: any[];
  prices: any[];
  source_urls: any[];
  tags: any[];
};
