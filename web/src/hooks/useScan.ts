import { useCallback, useState } from "react";
import { scan } from "../dataSource";
import type { Item } from "../types";

/** Scan state: the items, loading/error flags, and a `run` to (re)trigger a scan. */
export function useScan() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await scan());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, error, run };
}
