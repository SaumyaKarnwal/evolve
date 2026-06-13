export type Kind = "skill" | "rule" | "memory" | "instruction" | "style";

/** One config artifact found on disk, normalized into the uniform item shape (D2). */
export interface ScannedItem {
  kind: Kind;
  name: string;
  /** opaque payload — the system never parses it (D2). */
  body: string;
  contentHash: string;
  /** null = global (~/.claude); else the project's resolved path. */
  projectPath: string | null;
  sourcePath: string;
}

/** A Claude Code project discovered under ~/.claude/projects. */
export interface Project {
  /** resolved real path (from transcript cwd), or a best-effort decode if unresolved (PD3). */
  path: string;
  /** the encoded ~/.claude/projects/<dir> on disk. */
  claudeDir: string;
  lastActiveAt: number | null;
  resolved: boolean;
}

export interface Warning {
  reason: string;
  path: string;
}

export interface SyncResult {
  itemCount: number;
  projectCount: number;
  skipped: Warning[];
}
