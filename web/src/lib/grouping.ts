import { type Kind, KINDS } from "../types";

/** Group items into kind sections, in canonical KINDS order; empty kinds are omitted. */
export function groupByKind<T extends { kind: Kind; name: string }>(
  items: T[],
): Map<Kind, T[]> {
  const map = new Map<Kind, T[]>();
  for (const kind of KINDS) {
    const inKind = items
      .filter((i) => i.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (inKind.length) map.set(kind, inKind);
  }
  return map;
}

/** Count items per kind (all kinds present, defaulting to 0). */
export function countByKind<T extends { kind: Kind }>(
  items: T[],
): Record<Kind, number> {
  const counts: Record<Kind, number> = {
    Skill: 0,
    Rule: 0,
    Memory: 0,
    Command: 0,
    Agent: 0,
  };
  for (const item of items) counts[item.kind]++;
  return counts;
}

/** Filter items by kind + free-text query (matches name and body). */
export function filterItems<T extends { kind: Kind; name: string; body: string }>(
  items: T[],
  kind: Kind | null,
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (!kind || i.kind === kind) &&
      (!q ||
        i.name.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q)),
  );
}

/** A one-line preview of a body: first non-blank, non-heading, non-frontmatter line. */
export function preview(body: string): string {
  const line = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && l !== "---");
  if (!line) return "";
  return line.length > 140 ? line.slice(0, 139) + "…" : line;
}
