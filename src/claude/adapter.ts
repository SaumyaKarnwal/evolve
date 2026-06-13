import type { ScannedItem, Project, Warning } from "../types.js";
import { discoverProjects } from "./discovery.js";
import { parseSkills } from "./parsers/skill.js";
import { parseGlobalRules } from "./parsers/rule.js";
import { parseMemories } from "./parsers/memory.js";

export interface ScanResult {
  projects: Project[];
  items: ScannedItem[];
  warnings: Warning[];
}

/**
 * The ONLY module that knows the ~/.claude layout (D3). Everything path-shaped
 * lives behind here, so a Claude Code layout change is a one-file patch.
 * Phase 1 sources: global skills, global CLAUDE.md, per-project memory.
 */
export function scan(claudeRoot: string): ScanResult {
  const warnings: Warning[] = [];
  const warn = (w: Warning) => warnings.push(w);

  const projects = discoverProjects(claudeRoot);
  const items = [
    ...parseSkills(claudeRoot, warn),
    ...parseGlobalRules(claudeRoot, warn),
    ...parseMemories(projects, warn),
  ];
  return { projects, items, warnings };
}
