# Review — Evolve Phase 1 (design + plan readiness)

**Reviewer hat** · Scope note: no code exists yet, so this reviews the **design + implementation plan**
against the PRD/architecture for completeness and traps — not a line-level code review.

## Verdict: **Ship the plan** — implementable as written; 3 small adds, no blockers

## Alignment to PRD/architecture

- FR1–FR4 all map to a module + a test. ✓
- NFRs honored: read-only (adapter has no write path), offline, drop-rebuild keeps <3s, recoverable
  (rebuild from disk). ✓
- Scope discipline held: provenance/embedding/install/registry all deferred, schema seams intact. ✓
- The four TL decisions all resolved toward simplicity (drop-rebuild, one-item CLAUDE.md). ✓

## Findings

**P2 — `content_hash` is computed but, with drop-rebuild, unused in Phase 1.**
It's needed later (rename detection, embedding key, drift). Computing it now is cheap and forward-useful,
but flag it as *intentionally-ahead-of-need* so a future reader doesn't think it's dead. *Fix:* one-line
comment in `parsers`. (Keep it — it's the join seam, near-free.)

**P2 — Discovery reads "newest `*.jsonl`" — define "newest" + the zero-transcript path concretely.**
"Newest by mtime" is fine; just make the zero-`.jsonl` and missing-`cwd` cases both route to Unresolved
(not one to Unresolved and the other to a crash). *Fix:* single `resolveProjectPath(): string | UNRESOLVED`
returning a sentinel, tested by the no-transcript fixture.

**P2 — `name` collisions across the same kind+scope.** Two skills both named `review` in global scope
(shouldn't happen, but a malformed tree could). Drop-rebuild won't have a UNIQUE guard unless we add it.
*Fix:* keep the `UNIQUE(kind,name,project_path)` index even in Phase 1; on collision, skip-with-warning
(consistent with the malformed-file contract).

## What's good

- **Adapter as the single `~/.claude`-aware module** — the one decision that most reduces future pain.
- **Fixture tree for tests** — makes parsers/discovery testable without the dev's real machine; this is
  what lets Phase 1 have real regression tests from day one.
- **Honest "plan, not code" status line** — no overclaiming.

## Post-analysis passes

- *Vertical slice?* Yes — `sync` then `list` is a complete, demoable loop. ✓
- *Fail-silent check?* Covered — skip-with-warning + Unresolved group + empty-state all surface, never
  swallow. ✓ (matches core principle: never fail silent)
- *Over-engineering check?* Removed reconcile/stable-ids/embeddings from Phase 1. ✓
- *Security?* Read-only, local, no creds in Phase 1. ✓
- *Completeness?* The 3 P2s above are the only gaps; all are one-liners.

## Self-assessment: 8/10

Design is clean and minimal for the phase. The −2 is only because there's no code to review yet; the
plan itself is ship-ready with the 3 P2 adds folded in.
