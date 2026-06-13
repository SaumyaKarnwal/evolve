# Evolve

**Sync, share & pull Claude Code setups between people.** Local-first: your `~/.claude` config
(skills, rules, memories) stays on your machine; only what you deliberately publish reaches a public
registry. "GitHub for Claude setups."

> **Status:** Phase 1 (local sync) is implemented. Later phases (publish, pull, adopt, registry) are
> designed as seams — see the docs.
>
> **Docs live in [`SaumyaKarnwal/docs` → `evolve/`](https://github.com/SaumyaKarnwal/docs/tree/main/evolve)** —
> the consolidated TDD (decisions register + trade-off matrices), schema, and user stories. This repo is
> the code.

## What works now (Phase 1)

```bash
evolve sync     # scan ~/.claude → parse skills/rules/memories → index locally
evolve list     # show your inventory, grouped Global / per-project
```

- **Read-only** against `~/.claude` (only writes to `~/.evolve/evolve.db`).
- **Offline, no account** — sync/list need no network and no login.
- **Idempotent** — re-running `sync` with no disk change yields identical state.
- Skips malformed config with a warning (never aborts); projects whose path can't be resolved are
  grouped under "unresolved".

## Develop

Requires **Node ≥ 22** (uses the built-in `node:sqlite` — no native modules).

```bash
npm install
npm run build      # tsc → dist/
npm test           # node:test via tsx
npm run typecheck

# run without building:
npm run dev -- sync
npm run dev -- list

# run the built CLI:
node dist/cli.js sync --verbose
node dist/cli.js list
# flags: --claude-root <path>  --db <path>  --verbose
```

## Layout

```
src/
├── cli.ts                  # command dispatch (sync | list)
├── claude/                 # the ONLY ~/.claude-aware code (the "layout adapter")
│   ├── adapter.ts          # scan() — orchestrates discovery + parsers
│   ├── discovery.ts        # resolve project paths via transcript cwd (+ fallback)
│   └── parsers/{skill,rule,memory}.ts
├── store/db.ts             # node:sqlite — schema, drop-rebuild, queries
├── sync/sync.ts            # scan → dedupe → rebuild index
└── render/list.ts          # grouped output
test/
├── fixtures/dot-claude/    # fake ~/.claude tree for deterministic tests
└── sync.test.ts
```

## Design decisions (Phase 1)

- **Drop-and-rebuild** the index each sync (no provenance to preserve yet — reconcile lands with publish).
- **CLAUDE.md as one item** (splitting into rules is deferred to the publish phase).
- **TypeScript + `node:sqlite`** (built-in; zero native deps) + Node's built-in test runner.

Full reasoning: the [TDD](https://github.com/SaumyaKarnwal/docs/tree/main/evolve) decisions register
(D1–D29, PD1–PD4) and trade-off matrices.
