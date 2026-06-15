import { describe, expect, it } from "vitest";
import { applyMerge, buildMerge } from "./diff";

describe("buildMerge / applyMerge", () => {
  it("keeps shared lines as context and isolates the change as a hunk", () => {
    const yours = "line a\nline b\nline c";
    const theirs = "line a\nline B2\nline c";
    const merge = buildMerge(yours, theirs);

    expect(merge.hunks).toHaveLength(1);
    expect(merge.hunks[0].kind).toBe("modify");
    // taking theirs reproduces theirs; keeping mine reproduces yours
    expect(applyMerge(merge, { [merge.hunks[0].id]: "theirs" })).toBe(theirs);
    expect(applyMerge(merge, { [merge.hunks[0].id]: "mine" })).toBe(yours);
  });

  it("classifies a pure addition", () => {
    const merge = buildMerge("a\nb", "a\nb\nc");
    expect(merge.hunks).toHaveLength(1);
    expect(merge.hunks[0].kind).toBe("add");
    expect(merge.hunks[0].theirs).toEqual(["c"]);
    expect(merge.hunks[0].yours).toEqual([]);
  });

  it("classifies a local-only line", () => {
    const merge = buildMerge("a\nmine\nb", "a\nb");
    expect(merge.hunks[0].kind).toBe("local");
  });
});
