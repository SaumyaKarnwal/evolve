import type { Item, PublicItem, Publication, UserInfo } from "./types";

/** True when running inside the Tauri desktop shell (vs a plain browser). */
export const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/** Invoke a Tauri command, or reject in the browser (where the Rust engine isn't available). */
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error("This action needs the desktop app.");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** Scan ~/.claude via the Rust engine. Returns [] in the browser (no filesystem access). */
export async function scan(): Promise<Item[]> {
  if (!isTauri) return [];
  return call<Item[]>("scan");
}

// ---- auth ----
export const signInGoogle = () => call<UserInfo>("sign_in_google");
export const signOut = () => call<void>("sign_out");
/** On launch: restore a persisted session from the keychain (null if none / stale). */
export const restoreSession = () => call<UserInfo | null>("restore_session");

// ---- registry ----
export const listPublications = () => call<Publication[]>("list_publications");
/** Browse everyone's public publications (Discover). */
export const browsePublic = () => call<PublicItem[]>("browse_public");

export const publishItem = (item: Item) =>
  call<Publication>("publish_item", {
    kind: item.kind,
    name: item.name,
    hash: item.content_hash,
    body: item.body,
    anchor: item.source_anchor,
  });

export const unpublishItem = (item: { kind: string; name: string }) =>
  call<void>("unpublish_item", { kind: item.kind, name: item.name });
