// A small line-level diff (LCS) that powers the MergeView: given your text and theirs, produce an
// ordered list of context runs and "hunks" (runs that differ), each carrying both sides so the user
// can take theirs or keep mine per hunk.

export interface Hunk {
  id: string;
  kind: "add" | "local" | "modify"; // their addition / your local-only / reworded
  label: string;
  yours: string[];
  theirs: string[];
}

export type Segment = { type: "ctx"; lines: string[] } | { type: "hunk"; id: string };

export interface Merge {
  context: Segment[];
  hunks: Hunk[];
}

interface Block {
  eq: boolean;
  lines?: string[]; // when eq
  yours?: string[]; // when !eq
  theirs?: string[];
}

/** Classic LCS walk → blocks of equal lines and blocks of (yours-only / theirs-only) changes. */
function diffBlocks(a: string[], b: string[]): Block[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const blocks: Block[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      const lines: string[] = [];
      while (i < n && j < m && a[i] === b[j]) {
        lines.push(a[i]);
        i++;
        j++;
      }
      blocks.push({ eq: true, lines });
    } else {
      const yours: string[] = [];
      const theirs: string[] = [];
      while (i < n || j < m) {
        if (i < n && j < m && a[i] === b[j]) break;
        if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
          theirs.push(b[j]);
          j++;
        } else {
          yours.push(a[i]);
          i++;
        }
      }
      blocks.push({ eq: false, yours, theirs });
    }
  }
  return blocks;
}

const firstReal = (lines: string[]) => lines.find((l) => l.trim()) ?? "";

/** Build the merge model. Defaults: additions/rewords lean to "theirs"; your local-only lines to "mine". */
export function buildMerge(yours: string, theirs: string): Merge {
  const blocks = diffBlocks(yours.split("\n"), theirs.split("\n"));
  const context: Segment[] = [];
  const hunks: Hunk[] = [];
  let n = 0;
  for (const b of blocks) {
    if (b.eq) {
      context.push({ type: "ctx", lines: b.lines! });
      continue;
    }
    const id = `h${n++}`;
    const yoursLines = b.yours ?? [];
    const theirsLines = b.theirs ?? [];
    const kind = yoursLines.length === 0 ? "add" : theirsLines.length === 0 ? "local" : "modify";
    const label =
      kind === "add"
        ? firstReal(theirsLines)
        : kind === "local"
          ? firstReal(yoursLines)
          : firstReal(theirsLines) || firstReal(yoursLines);
    hunks.push({ id, kind, label: label.slice(0, 80), yours: yoursLines, theirs: theirsLines });
    context.push({ type: "hunk", id });
  }
  return { context, hunks };
}

/** Apply per-hunk decisions ("theirs" | "mine") to produce the merged text. */
export function applyMerge(
  merge: Merge,
  decisions: Record<string, "theirs" | "mine">,
): string {
  const out: string[] = [];
  for (const seg of merge.context) {
    if (seg.type === "ctx") {
      out.push(...seg.lines);
    } else {
      const h = merge.hunks.find((x) => x.id === seg.id)!;
      out.push(...(decisions[h.id] === "theirs" ? h.theirs : h.yours));
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
