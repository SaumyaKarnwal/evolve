import { describe, expect, it } from "vitest";
import { basename, buildProjects, projectName } from "./projects";
import type { Item, Scope } from "../types";

const proj = (real_path: string | null, encoded = "enc"): Scope => ({
  Project: { encoded, real_path },
});

const item = (scope: Scope): Item => ({
  kind: "Rule",
  name: "R",
  scope,
  source_anchor: null,
  content_hash: "h",
  body: "b",
});

describe("basename", () => {
  it("returns the last path segment", () => {
    expect(basename("/Users/auxia/source")).toBe("source");
    expect(basename("/Users/auxia/source/")).toBe("source");
  });
});

describe("projectName", () => {
  it("names Global, resolved repos, and unresolved scopes", () => {
    expect(projectName("Global")).toBe("Global");
    expect(projectName(proj("/Users/auxia/source"))).toBe("source");
    expect(projectName(proj(null, "-enc-x"))).toBe("-enc-x");
  });
});

describe("buildProjects", () => {
  it("buckets items per scope and sorts Global first, unresolved last", () => {
    const items = [
      item(proj("/Users/auxia/zeta")),
      item("Global"),
      item(proj(null, "-enc-x")),
      item(proj("/Users/auxia/alpha")),
      item(proj("/Users/auxia/alpha")), // same project, second item
    ];
    const projects = buildProjects(items);

    expect(projects.map((p) => p.name)).toEqual(["Global", "alpha", "zeta", "-enc-x"]);
    expect(projects.find((p) => p.name === "alpha")!.items).toHaveLength(2);
    expect(projects.find((p) => p.name === "-enc-x")!.unresolved).toBe(true);
  });
});
