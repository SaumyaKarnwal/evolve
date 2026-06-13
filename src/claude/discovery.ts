import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "../types.js";

/**
 * Discover Claude Code projects under ~/.claude/projects and resolve each to
 * its real path via the `cwd` recorded in a transcript. Falls back to a
 * best-effort decode of the encoded dir name, marking it unresolved (PD3).
 */
export function discoverProjects(claudeRoot: string): Project[] {
  const projectsDir = join(claudeRoot, "projects");
  let dirs: string[];
  try {
    dirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return []; // no projects dir
  }

  return dirs.map((dir) => {
    const claudeDir = join(projectsDir, dir);
    const { cwd, mtime } = resolveFromTranscript(claudeDir);
    return {
      path: cwd ?? decodeDir(dir),
      claudeDir,
      lastActiveAt: mtime,
      resolved: cwd !== null,
    };
  });
}

function resolveFromTranscript(claudeDir: string): {
  cwd: string | null;
  mtime: number | null;
} {
  let transcripts: { file: string; mtime: number }[];
  try {
    transcripts = readdirSync(claudeDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const file = join(claudeDir, f);
        return { file, mtime: statSync(file).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return { cwd: null, mtime: null };
  }
  if (transcripts.length === 0) return { cwd: null, mtime: null };

  const newest = transcripts[0];
  return { cwd: readCwd(newest.file), mtime: Math.floor(newest.mtime) };
}

function readCwd(file: string): string | null {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as { cwd?: unknown };
      if (typeof obj.cwd === "string" && obj.cwd) return obj.cwd;
    } catch {
      // skip malformed transcript line
    }
  }
  return null;
}

/** Best-effort: the encoder replaced "/" with "-", so this is lossy — hence `resolved=false`. */
function decodeDir(dir: string): string {
  return dir.startsWith("-") ? dir.replace(/-/g, "/") : dir;
}
