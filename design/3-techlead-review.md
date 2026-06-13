# Tech Lead Review — Evolve Phase 1: Local Sync

**Reviewer:** Tech Lead hat · Input: `prd.md`, `architecture.md` · Verdict ↓

## Verdict: **Needs Work** — 2 scope decisions to settle, then Ready

The shape is right and correctly phased. Two decisions are being over-built for Phase 1, and three
edge cases need defined behavior before coding. None are deep — all resolvable at this gate.

## What's strong

1. **Adapter isolation (D3)** — putting *all* `~/.claude` knowledge behind one module is exactly right;
   it quarantines the only real structural risk (layout drift).
2. **Correct deferrals** — embeddings and install pushed to the phases that need them. No 80MB model
   download to list files. This is the discipline that keeps Phase 1 shippable.
3. **Idempotency as an acceptance criterion**, not an afterthought — re-sync as a no-op is the right bar.

## Concerns (ranked)

**P1 — Reconcile is over-built for Phase 1 (simplicity / YAGNI).**
Reconcile + surrogate stable ids + content-hash rename-detection exist to **preserve provenance** across
syncs (D11′). But **Phase 1 has no provenance** — nothing references an item's id yet (publish/pull are
later). So in Phase 1 a rename is indistinguishable from delete+insert *with zero consequence*. Building
reconcile now is complexity with no Phase-1 payoff.
*Suggestion:* Phase 1 = **drop-and-rebuild** the `item` table each sync (it's <3s anyway). Introduce
reconcile + stable ids + mtime-skip in the phase that adds provenance, where they actually earn their
keep. This removes P1.4 entirely and shrinks P1.1/P1.5.
*Counter to weigh:* if you'd rather pay the complexity once, keeping reconcile avoids a small rework
later. My call: **defer it** — core principle is "don't add abstraction beyond what's asked."

**P1 — CLAUDE.md → rules split is the riskiest parser; decide its Phase-1 shape.**
Splitting one CLAUDE.md into N rules by `##` heading is heuristic and will misparse messy real files.
For *list-only* Phase 1 there are two honest options: (a) **split** (richer "12 rules" view, same parser
publish needs later) or (b) **one item** ("CLAUDE.md — global instructions", de-risked, split deferred to
the publish phase that truly needs it).
*Suggestion:* (b) for Phase 1 — list CLAUDE.md as a single `rule`-kind item; build the splitter when
publish-extraction lands and is actually exercised. Keeps the riskiest code out of the foundation.

**P2 — Transcript `cwd` resolution needs a defined fallback.**
What if a project dir has no transcripts, or the `cwd` field is absent? Undefined today.
*Suggestion:* fall back to a best-effort decode of the dir name; if still ambiguous, **list it under a
"Unresolved" group with a warning** rather than dropping it silently (core principle: never fail silent).

**P2 — Malformed-file behavior unspecified.**
A skill with no `SKILL.md`, broken frontmatter, unreadable file.
*Suggestion:* **skip-with-warning** (collect into a summary line: "3 items skipped — see `--verbose`"),
never abort the whole sync. Define this as a parser contract.

**P2 — CLI language is still "recommended," not decided.**
Architecture assumes TS/Node. It's a fine call, but it's load-bearing (distribution, future embeddings).
*Suggestion:* confirm TS/Node now so the scaffold (P1.0) isn't speculative.

## Missing pieces

- **Test strategy:** needs a **fixture `~/.claude` tree** committed to the repo so parsers + discovery +
  idempotent-resync are testable without depending on the dev's real machine. Add to P1.7.
- **`list` empty state** — first run before any sync; define the message.
- **Where `~/.evolve/` lives** — confirm `$HOME/.evolve/`, and `--db` override for tests.

## Hard questions to answer before coding

1. **Reconcile or drop-rebuild for Phase 1?** (P1 — I recommend drop-rebuild)
2. **CLAUDE.md: split into rules, or one item, in Phase 1?** (P1 — I recommend one item)
3. **Transcript-`cwd` fallback** — best-effort decode + "Unresolved" group? (P2)
4. **CLI language = TS/Node — confirmed?** (P2)

## Implementation risk: **Low**

Local, read-only, 4 tables, no network, no auth. The only genuine risks are parser heuristics (CLAUDE.md)
and layout assumptions — both contained by the adapter and the skip-with-warning contract. If P1 and P2
decisions land toward simplicity, this is a clean, low-risk Phase 1.
