import { useCallback, useEffect, useState } from "react";
import { browsePublic } from "../dataSource";
import type { PublicItem } from "../types";

/** Fetches the public Discover feed once `enabled` (signed in + on the Discover tab). */
export function useDiscover(enabled: boolean) {
  const [items, setItems] = useState<PublicItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await browsePublic());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !items && !loading) refresh();
  }, [enabled, items, loading, refresh]);

  return { items, loading, error, refresh };
}
