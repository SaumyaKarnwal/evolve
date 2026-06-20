# Bundling a gitignored config file as a Tauri resource

**Date:** 2026-06-20
**Area:** Release CI / Tauri bundling

## The problem

`evolve.config.json` is intentionally gitignored — it holds remote config we don't
want committed. But the Tauri bundle references `../evolve.config.json` as a
*resource*, so the file has to physically exist at build time. A fresh CI checkout
doesn't have it (it's gitignored), so the v0.2.1 release build failed with
`resource path doesn't exist`.

## The fix

Recreate the file from a GitHub Actions secret in a step that runs **before**
`tauri build`:

```yaml
- name: Write remote config
  run: printf '%s' "$EVOLVE_CONFIG_JSON" > evolve.config.json
  env:
    EVOLVE_CONFIG_JSON: ${{ secrets.EVOLVE_CONFIG_JSON }}
```

(See `.github/workflows/release.yml`, commit `15853e5`.)

## Why this is the takeaway

Two facts collide here, and missing either one breaks the build:

1. **Gitignored ≠ optional.** A file kept out of the repo can still be a hard build
   dependency. The `.gitignore` only governs version control — it says nothing about
   what the bundler needs on disk.
2. **The secret has to be materialized to a file, not just an env var.** The build
   reads a *path*, so exporting `EVOLVE_CONFIG_JSON` alone isn't enough — you have to
   write it out to the exact location the bundle config points at.

Use `printf '%s'` (not `echo`) to avoid a trailing newline or backslash-escape
surprises corrupting the JSON.
