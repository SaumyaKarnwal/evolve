import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScannedItem, Project, Warning } from "../../types.js";
import { sha256 } from "../../util.js";

/** Per-project memory fact files: ~/.claude/projects/<dir>/memory/*.md. */
export function parseMemories(
  projects: Project[],
  warn: (w: Warning) => void,
): ScannedItem[] {
  const items: ScannedItem[] = [];
  for (const project of projects) {
    const memDir = join(project.claudeDir, "memory");
    let files: string[];
    try {
      files = readdirSync(memDir).filter((f) => f.endsWith(".md"));
    } catch {
      continue; // this project has no memory dir
    }
    for (const f of files) {
      const path = join(memDir, f);
      let body: string;
      try {
        body = readFileSync(path, "utf8");
      } catch {
        warn({ reason: "unreadable memory file", path });
        continue;
      }
      items.push({
        kind: "memory",
        name: f.replace(/\.md$/, ""),
        body,
        contentHash: sha256(body),
        projectPath: project.path,
        sourcePath: path,
      });
    }
  }
  return items;
}
