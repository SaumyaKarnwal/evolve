import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

export const sha256 = (s: string): string =>
  createHash("sha256").update(s).digest("hex");

export const defaultClaudeRoot = (): string => join(homedir(), ".claude");

export const defaultDbPath = (): string =>
  join(homedir(), ".evolve", "evolve.db");
