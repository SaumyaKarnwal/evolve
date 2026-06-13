import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { scan } from "../src/claude/adapter.js";
import { sync } from "../src/sync/sync.js";
import { openDb, listItems } from "../src/store/db.js";

const FIX = join(import.meta.dirname, "fixtures", "dot-claude");

describe("scan", () => {
  it("parses skills, the global rule, and memories", () => {
    const r = scan(FIX);
    const keys = r.items.map((i) => `${i.kind}:${i.name}`);
    assert.ok(keys.includes("skill:greet"));
    assert.ok(keys.includes("rule:CLAUDE.md"));
    assert.ok(keys.includes("memory:feedback_x"));
  });

  it("warns on a skill with no SKILL.md (skip-with-warning)", () => {
    const r = scan(FIX);
    assert.ok(r.warnings.some((w) => w.path.includes("broken")));
    assert.ok(!r.items.some((i) => i.name === "broken"));
  });

  it("resolves project cwd and marks no-transcript dirs unresolved (PD3)", () => {
    const r = scan(FIX);
    assert.equal(r.projects.find((p) => p.resolved)?.path, "/Users/test/proj");
    assert.ok(r.projects.some((p) => !p.resolved));
  });
});

describe("sync", () => {
  it("is idempotent: running twice yields identical item state (FR1)", () => {
    const dir = mkdtempSync(join(tmpdir(), "evolve-"));
    const dbPath = join(dir, "e.db");

    const a = sync(FIX, dbPath);
    const rows1 = readRows(dbPath);
    const b = sync(FIX, dbPath);
    const rows2 = readRows(dbPath);

    assert.equal(b.itemCount, a.itemCount);
    assert.deepEqual(rows2, rows1);
    assert.ok(a.itemCount > 0);
  });
});

function readRows(dbPath: string): string[] {
  const db = openDb(dbPath);
  const rows = listItems(db)
    .map((r) => `${r.kind}:${r.name}:${r.project_path ?? ""}`)
    .sort();
  db.close();
  return rows;
}
