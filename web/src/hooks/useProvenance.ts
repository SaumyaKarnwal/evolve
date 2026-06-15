import { useCallback, useEffect, useState } from "react";
import { isTauri, listProvenance } from "../dataSource";
import type { Adopted } from "../types";

/** What you've adopted (local), indexed by source publication id — for "update available" checks. */
export function useProvenance(enabled: boolean) {
  const [bySource, setBySource] = useState<Map<string, Adopted>>(new Map());

  const refresh = useCallback(async () => {
    if (!enabled || !isTauri) {
      setBySource(new Map());
      return;
    }
    try {
      const list = await listProvenance();
      setBySource(new Map(list.map((a) => [a.source_id, a])));
    } catch {
      /* local store may not exist yet */
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bySource, refresh };
}
