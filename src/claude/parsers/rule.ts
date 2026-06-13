import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ScannedItem, Warning } from "../../types.js";
import { sha256 } from "../../util.js";

/**
 * Global rules. Phase 1 (PD2): treat the whole ~/.claude/CLAUDE.md as ONE
 * `rule` item. Splitting it into individual rules is the riskiest parser and
 * is only needed by the publish phase — deferred until then.
 */
export function parseGlobalRules(
  claudeRoot: string,
  warn: (w: Warning) => void,
): ScannedItem[] {
  const claudeMd = join(claudeRoot, "CLAUDE.md");
  if (!existsSync(claudeMd)) return [];
  let body: string;
  try {
    body = readFileSync(claudeMd, "utf8");
  } catch {
    warn({ reason: "unreadable CLAUDE.md", path: claudeMd });
    return [];
  }
  return [
    {
      kind: "rule",
      name: "CLAUDE.md",
      body,
      contentHash: sha256(body),
      projectPath: null,
      sourcePath: claudeMd,
    },
  ];
}
