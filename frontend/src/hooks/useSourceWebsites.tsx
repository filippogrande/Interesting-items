import { useState, useCallback } from "react";
import { fetchJson } from "../utils/format";
import type { SourceWebsite } from "../types";

export function useSourceWebsites() {
  const [sourceWebsitesStats, setSourceWebsitesStats] = useState<{
    websites: SourceWebsite[];
  } | null>(null);

  const loadSourceWebsitesStats = useCallback(async () => {
    try {
      const stats = await fetchJson<{ websites: SourceWebsite[] }>(
        "/api/dashboard/source_websites/stats",
      );
      setSourceWebsitesStats(stats);
      return stats;
    } catch {
      return null;
    }
  }, []);

  return {
    sourceWebsitesStats,
    setSourceWebsitesStats,
    loadSourceWebsitesStats,
  };
}
