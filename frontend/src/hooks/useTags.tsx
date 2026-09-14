import { useState, useMemo, useCallback } from "react";
import { fetchJson, buildTagLabel } from "../utils/format";
import type { Tag } from "../types";

type TagsStats = {
  tags: Array<Tag & { count: number }>;
  untagged_count: number;
} | null;

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsStats, setTagsStats] = useState<TagsStats>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagKind, setNewTagKind] = useState<Tag["kind"]>("taxonomy");
  const [newTagParentId, setNewTagParentId] = useState<number | "">("");

  const loadTagsStats = useCallback(async () => {
    try {
      const stats = await fetchJson<TagsStats>("/api/tags/stats");
      setTagsStats(stats);
      setTags(stats.tags);
      return stats;
    } catch {
      return null;
    }
  }, []);

  const createTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    const payload: any = {
      name: newTagName.trim(),
      kind: newTagKind,
    };
    if (newTagParentId !== "") {
      payload.parent_id = newTagParentId;
    }
    const resp = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    setNewTagName("");
    setNewTagKind("taxonomy");
    setNewTagParentId("");
    await loadTagsStats();
    return resp.json();
  }, [newTagName, newTagKind, newTagParentId, loadTagsStats]);

  const tagMap = useMemo(() => {
    const map = new Map<number, Tag>();
    tags.forEach((tag) => map.set(tag.id, tag));
    return map;
  }, [tags]);

  // Restituisce gli id degli antenati (dal parent più vicino alla radice).
  // Usa tagMap del closure (come l'originale), non lo richiede come parametro.
  const getAncestorIds = useCallback(
    (tagId: number): number[] => {
      const result: number[] = [];
      let current = tagMap.get(tagId);
      while (current && current.parent_id) {
        const pid = current.parent_id;
        if (!pid) break;
        result.unshift(pid);
        current = tagMap.get(pid);
      }
      return result;
    },
    [tagMap],
  );

  const toggleProductTag = useCallback((tagId: number, editingTagIds: number[], setEditingTagIds: React.Dispatch<React.SetStateAction<number[]>>) => {
    setEditingTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }, []);

  const tagsByKind = useMemo(() => {
    const groups: Record<string, Tag[]> = {
      taxonomy: [],
      store: [],
      project: [],
    };
    tags.forEach((tag) => {
      if (groups[tag.kind]) {
        groups[tag.kind].push(tag);
      }
    });
    return groups as Record<Tag["kind"], Tag[]>;
  }, [tags]);

  return {
    tags,
    setTags,
    tagsStats,
    setTagsStats,
    newTagName,
    setNewTagName,
    newTagKind,
    setNewTagKind,
    newTagParentId,
    setNewTagParentId,
    loadTagsStats,
    createTag,
    getAncestorIds,
    toggleProductTag,
    tagMap,
    tagsByKind,
  };
}
