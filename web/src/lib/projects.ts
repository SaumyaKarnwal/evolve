import { type Item, type Scope } from "../types";

/**
 * Group the scan into projects — one per scope. Worktrees are already excluded by the scanner, so
 * each scope is a genuinely distinct place (the global config, the home dir, a repo) with no
 * duplication to reconcile. This stays deliberately simple for that reason.
 */
export interface Project {
  key: string;
  name: string;
  path: string | null;
  items: Item[];
  unresolved: boolean;
}

/** Last non-empty path segment, e.g. `/Users/auxia/source` → `source`. */
export function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

interface ProjectId {
  key: string;
  name: string;
  path: string | null;
  unresolved: boolean;
}

/** The project a scope belongs to. */
function projectOf(scope: Scope): ProjectId {
  if (scope === "Global") {
    return { key: "__global", name: "Global", path: null, unresolved: false };
  }
  const p = scope.Project;
  if (!p.real_path) {
    return { key: `enc:${p.encoded}`, name: p.encoded, path: null, unresolved: true };
  }
  return { key: p.real_path, name: basename(p.real_path), path: p.real_path, unresolved: false };
}

/** The display name of the project a scope belongs to (used for the per-item project tag). */
export function projectName(scope: Scope): string {
  return projectOf(scope).name;
}

/** Bucket items into projects, Global first, then resolved by name, unresolved last. */
export function buildProjects(items: Item[]): Project[] {
  const map = new Map<string, { id: ProjectId; items: Item[] }>();
  for (const item of items) {
    const id = projectOf(item.scope);
    let entry = map.get(id.key);
    if (!entry) {
      entry = { id, items: [] };
      map.set(id.key, entry);
    }
    entry.items.push(item);
  }

  return [...map.values()]
    .map((e) => ({ ...e.id, items: e.items }))
    .sort((a, b) => {
      if (a.key === "__global") return -1;
      if (b.key === "__global") return 1;
      if (a.unresolved !== b.unresolved) return a.unresolved ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}
