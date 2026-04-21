/**
 * useGallery — fetches `list_versions` for a kind + entity_id and keeps the
 * result in React state. Call `refresh()` after a generation finishes to pull
 * the new version in.
 */

import { useCallback, useEffect, useState } from "react";
import { callTool } from "../api/mcp";
import type { GalleryVersion } from "../components/PromptCard";

interface SidecarEntry extends GalleryVersion {
  entity_type?: string;
  entity_id?: string;
  kind?: string;
  negative_prompt?: string;
  seed?: number;
  local_path?: string;
  source_tool?: string;
  source_task_id?: string;
}

interface ListVersionsResult {
  kind: string;
  entity_id: string;
  versions: SidecarEntry[];
}

export function useGallery(kind: string, entityId: string) {
  const [versions, setVersions] = useState<GalleryVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<GalleryVersion[]> => {
    setLoading(true);
    try {
      const { data } = await callTool<ListVersionsResult>("list_versions", { kind, entity_id: entityId });
      const next = data?.versions ?? [];
      setVersions(next);
      return next;
    } catch (err) {
      console.warn(`[useGallery ${kind}/${entityId}] failed:`, err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [kind, entityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { versions, loading, refresh };
}
