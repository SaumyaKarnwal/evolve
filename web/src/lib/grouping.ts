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

/**
 * A one-line preview of a body. Prefers a skill/agent's frontmatter `description:`,
 * otherwise the first real prose line — skipping YAML frontmatter, headings, and bare
 * `key: value` lines so cards show useful text instead of "name: <slug>".
 */
export function preview(body: string): string {
  const lines = body.split("\n");
  let bodyStart = 0;

  if (lines[0]?.trim() === "---") {
    const close = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (close > 0) {
      const desc = lines
        .slice(1, close)
        .map((l) => l.trim())
        .find((l) => /^description\s*:/i.test(l));
      if (desc) {
        const value = desc
          .slice(desc.indexOf(":") + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (value) return clamp(value);
      }
      bodyStart = close + 1; // no description — fall through to prose after the block
    }
  }

  const line = lines
    .slice(bodyStart)
    .map((l) => l.trim())
    .find(
      (l) =>
        l &&
        !l.startsWith("#") &&
        l !== "---" &&
        !/^(name|description|tools|model|allowed-tools|color)\s*:/i.test(l),
    );
  return line ? clamp(line) : "";
}

function clamp(s: string): string {
  return s.length > 140 ? s.slice(0, 139) + "…" : s;
}
