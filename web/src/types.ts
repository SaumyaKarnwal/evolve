// Mirrors the Rust `ScannedItem` as serialized over the Tauri IPC bridge.
// (Later we can auto-generate this from the Rust structs with ts-rs / tauri-specta.)

export type Kind = "Skill" | "Rule" | "Memory" | "Command" | "Agent";

export type Scope =
  | "Global"
  | { Project: { encoded: string; real_path: string | null } };

export interface Item {
  kind: Kind;
  name: string;
  scope: Scope;
  source_anchor: string | null;
  content_hash: string;
  body: string;
}

export const KINDS: Kind[] = ["Skill", "Rule", "Memory", "Command", "Agent"];

/** The signed-in user (from the Rust `current_user` / `sign_in_google` commands). */
export interface UserInfo {
  email: string | null;
  name: string | null;
}

/** A publication row from the registry (mirrors the Rust `Publication`). */
export interface Publication {
  id: string;
  owner_id: string;
  kind: string;
  name: string;
  visibility: string;
  latest_revision: number;
  current_hash: string | null;
  created_at: string;
  updated_at: string;
}

/** The status of a local item relative to the registry, for badges/toggles. */
export type PublishState =
  | { status: "unpublished" }
  | { status: "published"; revision: number }
  | { status: "drifted"; revision: number }; // published, but local content changed since

/**
 * Per-kind display metadata. `dotClass` reuses the mock's accent families (k-skill→coral,
 * k-rule→sage, etc.); `blurb` is the one-line description shown under a section heading.
 */
export const KIND_META: Record<
  Kind,
  { label: string; plural: string; dotClass: string; blurb: string }
> = {
  Skill: {
    label: "Skill",
    plural: "Skills",
    dotClass: "k-skill",
    blurb: "Invokable procedures Claude can run on demand.",
  },
  Rule: {
    label: "Rule",
    plural: "Rules",
    dotClass: "k-rule",
    blurb: "Standing instructions split from your CLAUDE.md, one per section.",
  },
  Memory: {
    label: "Memory",
    plural: "Memory",
    dotClass: "k-memory",
    blurb: "Facts Claude carries across sessions.",
  },
  Command: {
    label: "Command",
    plural: "Commands",
    dotClass: "k-command",
    blurb: "Slash commands you can call by name.",
  },
  Agent: {
    label: "Agent",
    plural: "Agents",
    dotClass: "k-agent",
    blurb: "Specialized sub-agents with their own tools and prompt.",
  },
};

/** The display label for a scope: the real path if resolved, else the encoded dir + a marker. */
export function scopeLabel(scope: Scope): string {
  if (scope === "Global") return "Global";
  const p = scope.Project;
  return p.real_path ?? `${p.encoded} (unresolved)`;
}
