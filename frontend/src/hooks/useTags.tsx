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

  const getAncestorIds = useCallback(
    (tagId: number, tagMap: Map<number, Tag>): number[] => {
      const ancestors: number[] = [];
      let current = tagMap.get(tagId);
      while (current?.parent_id) {
        ancestors.push(current.parent_id);
        current = tagMap.get(current.parent_id);
      }
      return ancestors;
    },
    [],
  );

  const toggleProductTag = useCallback((tagId: number) => {
    // Note: this returns a state updater function for use with setEditingTagIds
    // This matches the pattern used by useProductDetail's toggleProductTag
    return (current: number[]) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];
  }, []);

  const tagMap = useMemo(() => {
    const map = new Map<number, Tag>();
    tags.forEach((tag) => map.set(tag.id, tag));
    return map;
  }, [tags]);

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
