# Evolve

**Sync, share & pull Claude Code setups between people.** Local-first: your `~/.claude` config
(skills, rules, memories) stays on your machine; only what you deliberately publish reaches a public
registry. Think "GitHub for Claude setups" — pull a skill, adopt someone's whole build, push improvements.

> Status: **design phase.** This repo currently holds the design docs; Phase 1 (local sync) is specced
> and ready to implement.

## Start here

- **[TDD.md](./TDD.md)** — the consolidated technical design: vision, architecture, the full
  **decisions register**, and the **trade-off matrices**. Read this first.

## Deep dives

- **[docs/schema.md](./docs/schema.md)** — data model: local SQLite + Supabase Postgres registry, with
  Mermaid ER diagrams, RLS policies, and the decision trail (D1–D29).
- **[docs/user-stories.md](./docs/user-stories.md)** — the 7 MVP user stories (sync, publish, pull,
  adopt, update), each with flow, edge cases, and the explicit MVP simplifications.
- **[design/](./design)** — the design-pipeline trail: PRD → architecture → tech-lead review →
  implementation plan → review.

## Core ideas

- **Local-first & private by default** — private items have *no* registry row; publishing is the only
  moment anything crosses to the server.
- **Uniform item, atomic install** — every kind (skill/rule/memory) is one opaque-body item; installs
  are always a single-file write (no merge engine).
- **Anchor + append-only revisions** — published items keep an immutable revision history, so what you
  pulled stays byte-true forever and build reproducibility is free.
- **Idempotent everywhere** — overwrite-by-name or regenerate-from-source; never append.
- **Replaceable backend** — Supabase free tier (Postgres + pgvector + Auth), but data is portable
  Postgres and identity is broker-independent, so migration never loses accounts or items.

## Roadmap

| Phase | Scope |
|---|---|
| **1** | Local sync — scan `~/.claude`, index, `list` (this is what's specced) |
| 2 | Publish + registry + auth |
| 3 | Pull + similarity triage + install |
| 4 | Adopt-a-build + profiles + search |
| 5 | Updates, teams, LLM-assisted blend/split |
