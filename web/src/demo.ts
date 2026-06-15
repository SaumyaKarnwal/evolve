// Sample data so the web build runs in a plain browser (no Tauri / no backend) — for demos and for
// visually diffing against the mock. Only used when `isTauri` is false; the desktop app never sees it.
import type { Adopted, Item, PublicItem, Publication, UserInfo } from "./types";

const proj = (name: string): Item["scope"] => ({
  Project: { encoded: `-Users-demo-${name}`, real_path: `/Users/demo/${name}` },
});

const skill = (name: string, scope: Item["scope"], body: string): Item => ({
  kind: "Skill",
  name,
  scope,
  source_anchor: null,
  content_hash: name + body.length,
  body,
});

export const DEMO_USER: UserInfo = { email: "saumya@demo.dev", name: "Saumya Karnwal" };

export const DEMO_ITEMS: Item[] = [
  skill(
    "code-reviewer",
    "Global",
    "---\nname: code-reviewer\ndescription: Review PRs like a senior engineer.\n---\n\n# Code reviewer\n\nFor every PR:\n\n1. Check **correctness** before style.\n2. Flag missing tests for new branches.\n3. Prefer the smallest change that's correct.\n",
  ),
  skill(
    "frontend-design",
    "Global",
    "---\nname: frontend-design\n---\n\nBuild distinctive, production-grade UI. Avoid generic AI aesthetics. Pick real type and color, not defaults.",
  ),
  {
    kind: "Rule",
    name: "Code Comments",
    scope: "Global",
    source_anchor: "Code Comments",
    content_hash: "rule1",
    body: "## Code Comments\n\nComments explain **why**, not what. Keep the ones that carry context the code can't.",
  },
  {
    kind: "Command",
    name: "deploy",
    scope: "Global",
    source_anchor: null,
    content_hash: "cmd1",
    body: "# /deploy\n\nBuild, push, and roll out to dev.",
  },
  {
    kind: "Agent",
    name: "explorer",
    scope: "Global",
    source_anchor: null,
    content_hash: "agt1",
    body: "# explorer\n\nRead-only search agent for broad fan-out across the codebase.",
  },
  {
    kind: "Memory",
    name: "deploy-notes",
    scope: "Global",
    source_anchor: null,
    content_hash: "mem1",
    body: "Prod GCP project is `auxia-gcp`; dev is `deductive-reach-346018`.",
  },
  skill(
    "react-revise-checks",
    "Global",
    "---\nname: react-revise-checks\n---\n\n1. Flag stale closures in event handlers.\n2. Check effect dependency arrays.\n3. Prefer derived state over duplicated state.\n",
  ),
  skill(
    "react-review",
    proj("storefront"),
    "---\nname: react-review\n---\n\nReview React PRs: flag re-renders, missing memo, and effects that mirror props.",
  ),
  {
    kind: "Rule",
    name: "Migrations",
    scope: proj("storefront"),
    source_anchor: "Migrations",
    content_hash: "rule2",
    body: "## Migrations\n\nNever end a migration with COMMIT — the runner manages the transaction.",
  },
];

export const DEMO_PUBLICATIONS: Publication[] = [
  {
    id: "pub-code-reviewer",
    owner_id: "me",
    kind: "skill",
    name: "code-reviewer",
    visibility: "public",
    latest_revision: 2,
    current_hash: "code-reviewer" + DEMO_ITEMS[0].body.length,
    created_at: "",
    updated_at: "",
  },
];

const pub = (
  id: string,
  owner: string,
  kind: string,
  name: string,
  rev: number,
  pulls: number,
  body: string,
): PublicItem => ({
  id,
  owner_name: owner,
  kind,
  name,
  latest_revision: rev,
  body,
  updated_at: "",
  pulls,
});

export const DEMO_PUBLIC: PublicItem[] = [
  pub("pub-code-reviewer", "Saumya Karnwal", "skill", "code-reviewer", 2, 3, DEMO_ITEMS[0].body),
  pub(
    "p1",
    "Asim Prasad",
    "skill",
    "react-revise-checks",
    4,
    37,
    "---\nname: react-revise-checks\ndescription: Senior React review — state closures, effect deps, derived state.\n---\n\n1. Flag data closures in both handlers and effects.\n2. Check every effect dependency array bottom-and-top.\n3. Prefer derived state over duplicated state.",
  ),
  pub(
    "p2",
    "Priya Nair",
    "skill",
    "sql-query-optimizer",
    2,
    21,
    "---\nname: sql-query-optimizer\n---\n\nRead the EXPLAIN, find the table scan, add the index, re-check the plan.",
  ),
  pub(
    "p3",
    "Asim Prasad",
    "rule",
    "Async states",
    1,
    12,
    "## Async states\n\nEvery async surface needs a loading and an error state — including admin tables.",
  ),
  pub(
    "p4",
    "Devon Park",
    "command",
    "scaffold",
    1,
    8,
    "# /scaffold\n\nGenerate a typed module + test from a name.",
  ),
];

export const DEMO_PROVENANCE: Adopted[] = [];
