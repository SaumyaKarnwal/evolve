# Architecture — Evolve Phase 1: Local Sync

**Phase:** 1 (schema + sync) · **Author:** Architect hat · Input: `prd.md`, `docs/schema.md`, `docs/user-stories.md`

## Overview

A single local CLI (`evolve`) with two commands (`sync`, `list`), structured around **one deep module
that owns all `~/.claude` knowledge** (the layout adapter, D3) and a thin SQLite store. Everything else
is wiring.

```
evolve <cmd>
  │
  ├─ sync ──▶ ProjectDiscovery.discover()   ┐
  │          LayoutAdapter.scan()           ├─▶ Reconciler ──▶ Store (SQLite)
  │                                          ┘
  └─ list ──▶ Store.query() ──▶ Renderer (grouped: Global / per-project)

        ┌──────────────── LAYOUT ADAPTER (D3) ────────────────┐
        │  discoverProjects()  ·  scan() → ScannedItem[]       │
        │  parsers: skill · rule(CLAUDE.md §) · memory          │
        │  *** the ONLY module that knows ~/.claude paths ***   │
        └───────────────────────────────────────────────────────┘
```

## NFRs driving the design

- **Read-only on `~/.claude`** (safety) → adapter exposes *no* write path in Phase 1.
- **Idempotent, fast re-sync** (<3s; near-instant no-op) → `source_mtime` skip + content hashing.
- **Offline, no account** → zero network in Phase 1.
- **Layout drift is the top risk** → isolate all path knowledge behind one adapter (one-file patch).

## Components

| Module | Responsibility | Key interface |
|---|---|---|
| `cli/` | parse args, dispatch | `sync()`, `list()` |
| `claude/` (adapter) | all `~/.claude` knowledge | `discoverProjects(): Project[]`, `scan(): ScannedItem[]` |
| `claude/parsers/` | per-kind parse | `parseSkill`, `parseRules(claudeMd)`, `parseMemory` |
| `store/` | SQLite: schema, migrations, queries | `upsertProjects`, `getItems`, `applyReconcile` |
| `sync/` | diff scanned vs stored | `reconcile(scanned, stored): Plan` |
| `render/` | grouped list output | `renderList(items, projects)` |

`ScannedItem = { kind, name, body, contentHash, projectPath|null, sourcePath, sourceAnchor|null, mtime }`

## Data flow

- **sync:** `discoverProjects()` → upsert `project` rows → `scan()` (runs parsers) → `reconcile()` vs
  current `item` rows → apply inserts/updates/(renames)/deletes.
- **list:** query `item` + `project` → group by `project_path` (NULL = Global) → render; rank projects by
  `last_active_at`.

## Key trade-offs (decision / alternative / why / risk)

1. **Language = TypeScript/Node** · alt: Go, Python · *why:* in-process embeddings later
   (transformers.js/ONNX, no Python sidecar), shared types with the future Supabase/web registry (TS),
   `npx evolve` distribution · *risk:* needs Node installed (devs have it; can bundle via `bun`/`pkg`
   later). **Go's edge** (single static binary) is real but loses the shared-types + ONNX story.
2. **`better-sqlite3`** · alt: ORM / `node:sqlite` · *why:* synchronous API fits a CLI, mature, 4 tables
   need no ORM (over-engineering) · *risk:* native module (prebuilt binaries exist).
3. **Defer embeddings** · *why:* sync/list never use vectors — they're a pull-phase need; avoids an
   80MB model download in Phase 1 · *risk:* none for Phase 1.
4. **Reconcile (not drop-rebuild)** · *why:* idempotency is an FR1 acceptance criterion, and it's the
   Phase 2 shape (provenance preservation) · *risk:* rename-detection adds complexity **that arguably
   has no payoff in Phase 1** (no provenance exists yet) — flagged for Tech Lead.

## Execution plan (Phase 1 sub-steps)

- **P1.0** Repo scaffold (TS, `package.json`, `tsconfig`, CLI entry, `better-sqlite3`, `vitest`, README)
- **P1.1** `store/` — `schema.sql` (Part 1 tables), migration runner, repository
- **P1.2** adapter — `discoverProjects()` (resolve real path via transcript `cwd`)
- **P1.3** adapter — parsers: skill, rule (CLAUDE.md `##` sections → `source_anchor`), memory
- **P1.4** `sync/` — reconciler
- **P1.5** `sync` command wiring
- **P1.6** `list` command + grouped renderer
- **P1.7** tests (parser fixtures, idempotent re-sync, discovery) + docs

## Confidence: 8/10 — residual risks

- **`~/.claude` layout drift** — *the* structural risk; mitigated by adapter isolation (D3).
- **CLAUDE.md → rules parsing** — heuristic (`##` split); messy real files parse imperfectly. The
  riskiest parser. Acceptable for list-only Phase 1; matters more when publish-extraction lands.
- **Transcript `cwd` resolution** — relies on transcript presence/format; needs a defined fallback when a
  project dir has no transcripts.

## What I'd push back on from the PRD

- **FR4 rule splitting:** for *list-only* Phase 1, splitting CLAUDE.md into N rules is the riskiest
  parser. We *could* list CLAUDE.md as one item now and defer the split to the publish phase that
  actually needs it. I lean toward splitting (the "12 rules" view is more useful, same parser publish
  needs) — but it's a real de-risk option. Tech Lead to adjudicate.

## Will NOT address (deferred, designed as seams)

publish · pull · adopt · registry · auth/Supabase · embeddings · install/writes to `~/.claude` ·
MEMORY.md regeneration · web UI. Schema already carries the seams (provenance table, `source_anchor`,
visibility enum) so these land additively.
