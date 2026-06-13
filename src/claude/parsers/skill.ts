import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ScannedItem, Warning } from "../../types.js";
import { sha256 } from "../../util.js";

/** Global skills: ~/.claude/skills/<name>/SKILL.md → one item each. */
export function parseSkills(
  claudeRoot: string,
  warn: (w: Warning) => void,
): ScannedItem[] {
  const skillsDir = join(claudeRoot, "skills");
  let names: string[];
  try {
    names = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }

  const items: ScannedItem[] = [];
  for (const name of names) {
    const skillMd = join(skillsDir, name, "SKILL.md");
    if (!existsSync(skillMd)) {
      warn({ reason: "skill has no SKILL.md", path: join(skillsDir, name) });
      continue;
    }
    let body: string;
    try {
      body = readFileSync(skillMd, "utf8");
    } catch {
      warn({ reason: "unreadable SKILL.md", path: skillMd });
      continue;
    }
    items.push({
      kind: "skill",
      name,
      body,
      contentHash: sha256(body),
      projectPath: null,
      sourcePath: skillMd,
    });
  }
  return items;
}
