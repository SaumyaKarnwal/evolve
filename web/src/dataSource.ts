import type { Adopted, Item, PublicItem, Publication, UserInfo } from "./types";
import {
  DEMO_ITEMS,
  DEMO_PROVENANCE,
  DEMO_PUBLIC,
  DEMO_PUBLICATIONS,
  DEMO_USER,
} from "./demo";

/** True when running inside the Tauri desktop shell (vs a plain browser). */
export const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * In a plain browser (no Tauri), the app runs in DEMO mode against sample data — so it can be opened
 * on the web and visually compared to the mock. The desktop build always uses the real Rust commands.
 */
const DEMO = !isTauri;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function scan(): Promise<Item[]> {
  if (DEMO) return DEMO_ITEMS;
  return call<Item[]>("scan");
}

// ---- auth ----
export const signInGoogle = () => (DEMO ? Promise.resolve(DEMO_USER) : call<UserInfo>("sign_in_google"));
export const signOut = () => (DEMO ? Promise.resolve() : call<void>("sign_out"));
export const restoreSession = () =>
  DEMO ? Promise.resolve(DEMO_USER) : call<UserInfo | null>("restore_session");

// ---- registry ----
export const listPublications = () =>
  DEMO ? Promise.resolve(DEMO_PUBLICATIONS) : call<Publication[]>("list_publications");
export const browsePublic = () => (DEMO ? Promise.resolve(DEMO_PUBLIC) : call<PublicItem[]>("browse_public"));

export const recordPull = (id: string) => (DEMO ? Promise.resolve() : call<void>("record_pull", { id }));

export const noteAdopted = (id: string, kind: string, name: string, revision: number) =>
  DEMO ? Promise.resolve() : call<void>("note_adopted", { id, kind, name, revision });

export const listProvenance = () =>
  DEMO ? Promise.resolve(DEMO_PROVENANCE) : call<Adopted[]>("list_provenance");

/** Outcome of adopting an item into the local ~/.claude. */
export type InstallOutcome = "Created" | "Overwritten" | "Exists" | "Unsupported";

/** Write a kind/name/body into the local config. The low-level primitive behind adopt + merge. */
export const adoptRaw = (
  kind: string,
  name: string,
  body: string,
  overwrite: boolean,
  projectPath: string | null = null,
): Promise<InstallOutcome> =>
  DEMO
    ? Promise.resolve("Created")
    : call<InstallOutcome>("adopt_item", { kind, name, body, overwrite, project: projectPath });

/** Adopt a public item into the local config. `projectPath` null = global ~/.claude. */
export const adoptItem = (item: PublicItem, overwrite: boolean, projectPath: string | null = null) =>
  adoptRaw(item.kind, item.name, item.body, overwrite, projectPath);

export const publishItem = (item: Item): Promise<Publication> =>
  DEMO
    ? Promise.resolve({
        id: `demo-${item.name}`,
        owner_id: "me",
        kind: item.kind.toLowerCase(),
        name: item.name,
        visibility: "public",
        latest_revision: 1,
        current_hash: item.content_hash,
        created_at: "",
        updated_at: "",
      })
    : call<Publication>("publish_item", {
        kind: item.kind,
        name: item.name,
        hash: item.content_hash,
        body: item.body,
        anchor: item.source_anchor,
      });

export const unpublishItem = (item: { kind: string; name: string }) =>
  DEMO ? Promise.resolve() : call<void>("unpublish_item", { kind: item.kind, name: item.name });
