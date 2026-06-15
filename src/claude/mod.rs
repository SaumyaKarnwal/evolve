//! The Claude config adapter — the only place that knows the `~/.claude` layout (D3).

mod discovery;
mod parsers;

use std::fs;
use std::path::Path;

use crate::model::{Kind, ScannedItem, Scope};
use parsers::{scan_claude_md, scan_md_files, scan_skill_dir};

/// Scan all Claude config into one uniform item list. Best-effort: missing sources are just skipped.
///
/// Each `CLAUDE.md` is kept WHOLE as one `rule`, and kept SEPARATE per source (global vs each project)
/// — rules are never merged together and never split apart.
pub fn scan(claude_root: &Path) -> Vec<ScannedItem> {
    let mut items = Vec::new();

    // --- global config under ~/.claude ---
    let global = Scope::Global;
    items.extend(scan_skill_dir(&claude_root.join("skills"), &global));
    items.extend(scan_claude_md(&claude_root.join("CLAUDE.md"), &global));
    items.extend(scan_md_files(
        &claude_root.join("commands"),
        Kind::Command,
        &global,
    ));
    items.extend(scan_md_files(
        &claude_root.join("agents"),
        Kind::Agent,
        &global,
    ));

    // --- per project ---
    for project in discovery::discover_projects(claude_root) {
        let scope = Scope::Project {
            encoded: project.encoded.clone(),
            real_path: project.real_path.clone(),
        };

        // auto-memory lives under the ENCODED dir (~/.claude/projects/<dir>/memory)
        items.extend(scan_md_files(
            &project.claude_dir.join("memory"),
            Kind::Memory,
            &scope,
        ));

        // project-local config lives in the REAL dir — only reachable if we resolved it
        if let Some(real) = &project.real_path {
            let real = Path::new(real);
            items.extend(scan_claude_md(&real.join("CLAUDE.md"), &scope));

            // A project rooted at the home dir resolves its `.claude` to ~/.claude itself, so its
            // skills/commands/agents ARE the global ones (already scanned above). Skip them to avoid
            // double-counting; the project's own CLAUDE.md and memory stay (they're distinct files).
            let dot_claude = real.join(".claude");
            if !same_dir(&dot_claude, claude_root) {
                items.extend(scan_skill_dir(&dot_claude.join("skills"), &scope));
                items.extend(scan_md_files(
                    &dot_claude.join("commands"),
                    Kind::Command,
                    &scope,
                ));
                items.extend(scan_md_files(
                    &dot_claude.join("agents"),
                    Kind::Agent,
                    &scope,
                ));
            }
        }
    }

    items
}

/// Whether two paths point at the same directory, resolving symlinks/`..` when possible and falling
/// back to a literal comparison if either can't be canonicalized (e.g. doesn't exist).
fn same_dir(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}
