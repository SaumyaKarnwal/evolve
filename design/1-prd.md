# PRD — Evolve Phase 1: Local Sync

**Status:** Draft for review · **Phase:** 1 of N (schema + sync only) · **Author:** PM hat

## Problem (who / what / why)

A Claude Code user accumulates configuration — skills, rules, memories — **scattered across many
projects** on their machine (`~/.claude/` globally + per-project dirs). Today there is **no single,
structured view** of "everything I've built." You can't see it, search it, or reason about it, let
alone share it.

Before *any* sharing feature (publish/pull/adopt) can exist, there must be a reliable way to **read
your own setup into a structured, queryable local index.** Phase 1 builds exactly that — and nothing
more. It's the foundation every later phase stands on.

## Proposed solution

A local CLI, `evolve`, that:
1. **Discovers** every Claude Code project on the machine and resolves its real path.
2. **Scans & parses** each config source (skills, rules incl. CLAUDE.md sections, memories) into one
   uniform item model.
3. **Reconciles** them into a local SQLite index (`~/.evolve/evolve.db`).
4. **Lists** them back, grouped Global / per-project.

Entirely **local, offline, read-only** against `~/.claude`. No account, no network, no writes to your
config. (Schema already designed — see `docs/schema.md`, Part 1.)

## Functional requirements (Phase 1 MVP)

| # | Requirement | Acceptance criteria |
|---|---|---|
| FR1 | `evolve sync` scans & reconciles into SQLite | Re-running with no disk change is a **no-op** (idempotent); an edited file updates its row; a new file is added; a renamed file is detected via `content_hash` (not duplicated) |
| FR2 | `evolve list` shows the inventory | Items grouped **Global / per-project**, each with kind + name; dead worktrees ranked below active projects |
| FR3 | Project discovery resolves real paths | Encoded `~/.claude/projects/<dir>` names resolved to true paths via the transcript `cwd`; verified on a machine with ≥3 projects |
| FR4 | Parsers per kind | `skill` (folder), `rule` (CLAUDE.md section → `source_anchor`), `memory` (fact file) each parse into an item with correct `kind`/`name`/`project_path`/`source_anchor` |

## Non-functional requirements

- **Performance:** full sync of a typical machine (~30 skills, ~50 memories, ~5 projects) in **< 3s**;
  idempotent re-sync near-instant via `source_mtime` skip.
- **Safety:** Phase 1 is **read-only** against `~/.claude` — sync writes *only* to `~/.evolve/`. (Writing
  into `~/.claude` is install, a Phase 2 concern.)
- **Offline / no-account:** works with no network and no login (US1 never needs identity).
- **Portability:** macOS + Linux.
- **Recoverability:** deleting `~/.evolve/` and re-syncing fully rebuilds the content mirror (provenance
  is empty in Phase 1, so nothing precious exists yet).

## Scope boundaries

**IN:** discover · scan · parse · reconcile · list — local, read-only.
**OUT (later phases, designed as seams only):** publish, pull, adopt, the registry, auth/Supabase,
**embeddings** (only needed for pull-time similarity), install/writing to `~/.claude`, the MEMORY.md
index regeneration (an install concern).

## Open questions (for the Architect)

1. **CLI runtime/language** — TypeScript/Node (shares types with a future web UI, ONNX-ready),
   Python, or Go? This is the biggest unresolved decision; it shapes everything downstream.
2. **Embeddings in Phase 1?** Recommend **defer** — sync+list don't need vectors; they're a pull-phase
   need. (Keeps Phase 1 dependency-light: no model download.)
3. **Reconcile vs. rebuild** — confirm the reconcile (match by `(kind,name,project_path)` + content-hash
   rename detection) is worth the complexity in Phase 1, given provenance is empty until publish exists.
