#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { sync } from "./sync/sync.js";
import { renderList } from "./render/list.js";
import { defaultClaudeRoot, defaultDbPath } from "./util.js";

interface Args {
  cmd: string | undefined;
  db: string;
  claudeRoot: string;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    cmd: argv[0],
    db: defaultDbPath(),
    claudeRoot: defaultClaudeRoot(),
    verbose: false,
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--db") args.db = argv[++i];
    else if (a === "--claude-root") args.claudeRoot = argv[++i];
    else if (a === "--verbose" || a === "-v") args.verbose = true;
  }
  return args;
}

const USAGE = `evolve — sync & list your Claude Code setup

Usage:
  evolve sync [--claude-root <path>] [--db <path>] [--verbose]
  evolve list [--db <path>]`;

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  switch (args.cmd) {
    case "sync": {
      const r = sync(args.claudeRoot, args.db);
      console.log(
        `Synced ${r.itemCount} items across ${r.projectCount} projects.`,
      );
      if (r.skipped.length > 0) {
        console.log(
          `${r.skipped.length} skipped${args.verbose ? ":" : " (use --verbose to list)"}`,
        );
        if (args.verbose) {
          for (const s of r.skipped) console.log(`  - ${s.reason}: ${s.path}`);
        }
      }
      break;
    }
    case "list":
      console.log(renderList(args.db));
      break;
    default:
      console.log(USAGE);
      if (args.cmd && args.cmd !== "--help" && args.cmd !== "-h") {
        process.exitCode = 1;
      }
  }
}

main();
