# Evolve — MVP User Stories

> **What Evolve is:** a tool to sync, share, and pull Claude Code setups (skills, rules, memories)
> between people. Local-first: your config lives on your machine; only what you deliberately
> publish reaches the registry.

**Actor:** an individual Claude Code user (e.g. Saumya). **Counterparty:** another user whose setup they want.
**Item kinds:** `skill` · `rule` · `memory` · (`instruction`, `style` deferred/edge).
**Spine principle:** idempotent install — every operation yields the same result run once or five times.

---

## Epic A — Know my own setup (local only, no account)

### US1 — See everything I've built
*As a user, I run one command and see my entire Claude setup, grouped, so I have a single inventory.*

- **Trigger:** `evolve sync` then `evolve list`
- **Flow:** discover projects (via transcript `cwd`) → scan `~/.claude` → parse each source into Items
  (all private) → reconcile into local DB → embed locally → list grouped Global / per-project.
- **Done when:** every skill, rule (extracted from CLAUDE.md), and memory fact file appears with
  kind + scope + visibility badge; re-running `sync` changes nothing if disk is unchanged.
- **Edge cases:**
  - File edited since last sync → content reconciled, identity + provenance preserved.
  - File renamed → rename-detection by content hash; if it fails, `evolve relink`.
  - Local DB is durable for identity/provenance, a mirror for content.
- **MVP cut:** local view is always *latest only* — no local history (that's git's job).

---

## Epic B — Share what I built

### US2 — Publish a skill / expose my rules
*As a user, I deliberately make something public under my name so others can use it.*

- **Trigger:** `evolve publish <skill>` (skills, individual) · `evolve publish-rules` (rules, batched from CLAUDE.md)
- **Flow:** render exact content → **secret/PII scan (hard gate)** → confirm → create `published_item`
  + `revision` v1 (embedded server-side) → store the publish link locally in provenance → return URL `handle/name`.
- **Done when:** the item is fetchable at its URL; my local item now shows "published"; private items
  I did *not* publish have **zero** registry presence.
- **Edge cases:**
  - Name collision in my namespace → `UNIQUE(owner, name)` rejects; prompt to rename.
  - Rules are stored as individual items but published in one batch action.
  - Publishing = the only moment anything crosses to the server.
- **MVP cut:** no individual-rule publish UX (rules ride the build); styles not publishable.

---

## Epic C — Consume what others built

### US3 — Pull one item
*As a user, I take someone's item and it lands working in my real `~/.claude`.*

- **Trigger:** `evolve pull <handle>/<name>`
- **Flow:** fetch item + latest revision (+ server-computed embedding) → **similarity triage** vs my
  local corpus (hash → fuzzy → embedding) → branch:
  - exact dup → skip (tell me),
  - no match → install clean,
  - similar → conflict UX: `keep mine / take theirs / keep both / blend` (blend = manual editor
    pre-filled; `claude -p` draft optional) → **install as a standalone file** → record provenance:
    revision taken + disposition.
- **Done when:** the file exists in the right `~/.claude` path; Claude Code can use it; my provenance
  pins the exact revision + how I resolved it.
- **Edge cases:**
  - Similarity never auto-merges — it only *chooses which UX to show* (high cosine = related, not agreeing).
  - Memory pull also regenerates the MEMORY.md index section, never appends.
  - No `claude` binary → blend is manual-only; everything else works.
- **MVP cut:** no merge-into-shared-file; pulled rules are separate files, not woven into my CLAUDE.md.

### US4 — Adopt a build
*As a user, I take a respected person's whole public set to bootstrap mine.*

- **Trigger:** `evolve adopt <handle>`
- **Flow:** fetch their public set (`items WHERE owner AND visibility=PUBLIC`) → per-item
  **copy / skip** loop → each copy = US3's pipeline.
- **Done when:** chosen items are installed; "build" needed no new entity — it's the query result.
- **Edge cases:** re-adopt is safe — standalone files overwrite by name, index regenerates; no duplicates.
- **MVP cut:** no named/curated builds — adopt = "all their public items"; `blend` per item available
  but `skip` is the common batch choice.

---

## Epic D — Keep things current over time

### US5 — Improve a published item
*As a user, I push a better version without breaking people on the old one.*

- **Trigger:** `evolve publish <item>` again (deliberate)
- **Flow:** local provenance resolves *which* published item this is → append **revision N+1**
  (rev 1 untouched) → move the item's `latest_revision_id` pointer.
- **Done when:** new pullers get the latest; old pullers' pinned revision is byte-identical to what
  they took (append-only).
- **Edge cases:**
  - Edited-but-not-republished = **drift**, shown by `evolve status` via cached published hash. Drift
    is a state, not an error.
  - Re-publish never overwrites a prior revision.
- **MVP cut:** re-publish is always manual; no auto-sync of local edits.

### US6 — Know when an update is available
*As a user, I'm told when something I pulled has a newer revision.*

- **Trigger:** `evolve status` / `evolve outdated`
- **Flow:** compare my pinned `pulled_revision` against the item's current `latest_revision_id`.
- **Done when:** outdated pulls are listed; I can re-pull to update.
- **Edge cases:** if I *blended* originally (disposition), warn that re-pulling may clobber my edits.
- **MVP cut:** updates are *surfaced only* — never auto-applied.

---

## Epic E — Cross-cutting guarantees (apply to every story)

- **Privacy is structural** — private = no registry row; reads fail-closed to `visibility=PUBLIC`.
- **Idempotent install everywhere** — standalone files (overwrite-by-name) or regenerated indexes; never append.
- **Identity ≠ label** — ids are identity; names/URLs are labels; renames don't cascade.
- **Graceful degradation** — no account → US1 works; no `claude` → blend manual; server down → all local ops work.
- **One layout adapter** owns all `~/.claude` path knowledge — `scan()` / `install()`.
- **Deletion is safe** — deleting a local file (or the whole local DB) never unpublishes and never loses
  anything published or pulled; the registry holds the durable facts. Recovery = `sync` → auto-rebind by
  content hash → `relink` leftovers. Unpublish is a separate explicit act. Only never-published private
  files depend on your own backups (D24, D25).

---

## Explicit MVP simplifications (decided, not accidental)

1. No merge engine — pulled items never merge into a shared file.
2. Rules: individual items, atomic file install, **batched** publish; no per-rule publish UX.
3. Memory: fact file = item; index section regenerated (or index-touch deferred).
4. Styles: cloud-only, deferred from the core loop.
5. Builds: implicit (= public items); no named/curated builds yet.
6. Updates surfaced, never auto-applied.
7. Local view = latest only, no local history.

---

## Item-kind handling reference

| Kind | On disk | Install target | Notes |
|------|---------|----------------|-------|
| `skill` | `~/.claude/skills/<name>/` (folder) | drop folder | atomic; individually publishable |
| `rule` | section in CLAUDE.md (your setup) OR `.claude/rules/<name>.md` | `.claude/rules/<name>.md` (standalone) | extract-on-publish, install-as-file; batched publish |
| `memory` | `memory/<name>.md` + line in MEMORY.md | fact file + regenerate index section | `type: project` → private default; `type: feedback` → shareable |
| `instruction` | section in CLAUDE.md | installs as a rule file | same path as rule |
| `style` | cloud (claude.ai), no local file | deferred | not in core loop |
