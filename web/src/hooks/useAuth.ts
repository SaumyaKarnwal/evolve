import { useCallback, useEffect, useState } from "react";
import { currentUser, isTauri, signInGoogle, signOut } from "../dataSource";
import type { UserInfo } from "../types";

/** Auth state: the current user, a busy flag during sign-in, and sign in/out actions. */
export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On launch, ask the Rust side if a session already exists (it won't yet in v1, but cheap + future-proof).
  useEffect(() => {
    if (!isTauri) return;
    currentUser()
      .then(setUser)
      .catch(() => {});
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

  return { user, busy, error, signIn, logOut };
}
