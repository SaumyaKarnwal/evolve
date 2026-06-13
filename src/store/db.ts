import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ScannedItem, Project } from "../types.js";

// Phase 1 schema subset: only `item` + `project`. `provenance`, `embedding`,
// stable ids, and source_anchor are deferred to the phases that need them
// (PD1 — drop-rebuild means none are needed yet). `item.id` is a plain
// autoincrement: nothing references it in Phase 1.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS project (
  path           TEXT PRIMARY KEY,
  claude_dir     TEXT NOT NULL,
  last_active_at INTEGER,
  resolved       INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS item (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL CHECK (kind IN ('skill','rule','memory','instruction','style')),
  name         TEXT NOT NULL,
  body         TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  project_path TEXT,
  source_path  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_kind_project ON item(kind, project_path);
`;

export function openDb(dbPath: string): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

export function upsertProjects(db: DatabaseSync, projects: Project[]): void {
  const stmt = db.prepare(
    `INSERT INTO project (path, claude_dir, last_active_at, resolved)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       claude_dir     = excluded.claude_dir,
       last_active_at = excluded.last_active_at,
       resolved       = excluded.resolved`,
  );
  for (const p of projects) {
    stmt.run(p.path, p.claudeDir, p.lastActiveAt, p.resolved ? 1 : 0);
  }
}

/** Drop-and-rebuild the item table in one transaction (PD1). */
export function replaceItems(db: DatabaseSync, items: ScannedItem[]): void {
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM item");
    const stmt = db.prepare(
      `INSERT INTO item (kind, name, body, content_hash, project_path, source_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const it of items) {
      stmt.run(
        it.kind,
        it.name,
        it.body,
        it.contentHash,
        it.projectPath,
        it.sourcePath,
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export interface ListedItem {
  kind: string;
  name: string;
  project_path: string | null;
}

export function listItems(db: DatabaseSync): ListedItem[] {
  return db
    .prepare(
      `SELECT kind, name, project_path FROM item
       ORDER BY project_path IS NOT NULL, project_path, kind, name`,
    )
    .all() as unknown as ListedItem[];
}

export interface ListedProject {
  path: string;
  resolved: number;
  last_active_at: number | null;
}

export function listProjects(db: DatabaseSync): ListedProject[] {
  return db
    .prepare(`SELECT path, resolved, last_active_at FROM project`)
    .all() as unknown as ListedProject[];
}
