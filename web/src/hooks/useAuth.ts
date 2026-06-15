import { useCallback, useEffect, useState } from "react";
import { restoreSession, signInGoogle, signOut } from "../dataSource";
import type { UserInfo } from "../types";

/**
 * Auth state. On launch it tries to restore a persisted session from the keychain (`restoring`),
 * so a returning user lands straight in the app without signing in again.
 */
export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // restoreSession returns the demo user in a browser, the keychain session in Tauri
    restoreSession()
      .then(setUser)
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setUser(await signInGoogle());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const logOut = useCallback(async () => {
    await signOut().catch(() => {});
    setUser(null);
  }, []);

  return { user, restoring, busy, error, signIn, logOut };
}
