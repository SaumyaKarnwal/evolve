# Implementation Plan — Evolve Phase 1: Local Sync

**Engineer hat** · Input: `prd.md`, `architecture.md`, `techlead_review.md`

## Locked decisions (from TL gate, auto-resolved to recommendations)

| # | Decision | Resolution |
|---|---|---|
| PD1 | reconcile vs drop-rebuild | **drop-and-rebuild** the `item` table each sync (no provenance to preserve yet) |
| PD2 | CLAUDE.md split | **one `rule` item** ("CLAUDE.md — global instructions"); splitter deferred to publish phase |
| PD3 | transcript-`cwd` fallback | resolve via `cwd`; else best-effort decode; else **"Unresolved" group + warning** |
| PD4 | language | **TypeScript / Node** (Node 24 verified on machine) |
| + | tests | committed **fixture `~/.claude` tree**; `list` empty-state message; `--db` override |

**Phase 1 schema subset:** only `item` + `project` are created. `provenance`, `embedding`, stable
ids, `source_anchor` split, and `source_mtime` skip are **deferred** (drop-rebuild makes them
unnecessary now) — added as additive migrations in the phase that needs them.

## File tree

```
evolve/
├── package.json · tsconfig.json · .gitignore
├── README.md
├── src/
│   ├── cli.ts                 # entry; dispatch sync | list; --db override
│   ├── store/
│   │   ├── schema.sql         # Phase 1: item + project only
│   │   └── db.ts              # better-sqlite3 open + migrate + queries
│   ├── claude/
│   │   ├── adapter.ts         # discoverProjects(), scan() — the ONLY ~/.claude-aware module (D3)
│   │   ├── discovery.ts       # transcript cwd resolution + fallback (PD3)
│   │   └── parsers/{skill,rule,memory}.ts
│   ├── sync/sync.ts           # discover → scan → drop-rebuild write
│   └── render/list.ts         # grouped output (Global / per-project / Unresolved)
└── test/
    ├── fixtures/dot-claude/   # committed fake ~/.claude for deterministic tests
    └── {parsers,discovery,sync}.test.ts
```

## Per-module logic

- **`store/db.ts`** — open `~/.evolve/evolve.db` (or `--db`); run `schema.sql` (idempotent
  `CREATE TABLE IF NOT EXISTS`); expose `replaceItems(items)` (drop-rebuild in a txn),
  `upsertProjects`, `getItemsGrouped`.
- **`claude/discovery.ts`** — list `~/.claude/projects/*`; for each, read newest `*.jsonl`, pull first
  `cwd`; fall back to dir-name decode; else mark `unresolved`. Returns `Project[]`.
- **`claude/parsers/`** — `skill`: each `~/.claude/skills/<n>/SKILL.md` → item; `rule`: each
  `CLAUDE.md` → ONE item (PD2); `memory`: each `memory/*.md` fact file → item. All compute
  `content_hash` (sha256). Malformed → **skip-with-warning** (collected, surfaced in summary).
- **`sync/sync.ts`** — orchestrate: discover → upsert projects → scan → `replaceItems` in one txn →
  print summary (`N items across M projects; K skipped`).
- **`render/list.ts`** — group by `project_path` (NULL→Global, unresolved→Unresolved), order projects by
  `last_active_at`; empty-state message when no rows.

## Dependencies

`better-sqlite3` (store), a small arg parser (`clipanion` or hand-rolled), `vitest` (test). No network,
no embedding model, no ORM.

## Test plan

- **Parsers** — fixture tree → assert kind/name/project_path/content_hash.
- **Discovery** — fixture with (a) a normal project, (b) a no-transcript dir → assert resolution +
  Unresolved fallback.
- **Idempotency** — sync the fixture twice → identical DB state (the FR1 acceptance bar).
- **Skip-with-warning** — fixture with a malformed skill → sync completes, item skipped, warning emitted.

## Build verification (when coded)

`npm run build` (tsc) + `npm test` (vitest) green before "done". No Spotless equivalent yet; add
`prettier --check` in P1.0.

> **Status:** this is the *plan* artifact. Actual code is the next executable step (a build task), not
> part of this design-doc deliverable — flagged so "done" isn't overclaimed.
