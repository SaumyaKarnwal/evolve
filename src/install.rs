//! Writing config back into `~/.claude` — the counterpart to the read-only scanner, and the adopt
//! flow's first writes. Atomic kinds (skill/command/agent) write a file; a rule appends a section to
//! `CLAUDE.md`. Names are sanitized so a write can never escape the claude root. Existing files are
//! never clobbered unless `overwrite` is set — the caller decides after a preview.

use std::fs;
use std::path::Path;

use crate::model::Kind;

/// What an install did (or declined to do).
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub enum InstallOutcome {
    Created,
    Overwritten,
    /// Something with that identity already exists and `overwrite` was false — skipped.
    Exists,
    /// This kind can't be adopted yet (memory; or a rule whose heading already exists → needs merge).
    Unsupported,
}

/// Install one item under `claude_root`. Returns the outcome; errors only on unsafe input or I/O.
pub fn install(
    claude_root: &Path,
    kind: Kind,
    name: &str,
    body: &str,
    overwrite: bool,
) -> Result<InstallOutcome, String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("unsafe item name: {name:?}"));
    }
    match kind {
        Kind::Skill => {
            write_file(&claude_root.join("skills").join(name).join("SKILL.md"), body, overwrite)
        }
        Kind::Command => {
            write_file(&claude_root.join("commands").join(format!("{name}.md")), body, overwrite)
        }
        Kind::Agent => {
            write_file(&claude_root.join("agents").join(format!("{name}.md")), body, overwrite)
        }
        Kind::Rule => append_rule(&claude_root.join("CLAUDE.md"), name, body),
        // Memory is personal context — adopting it isn't a flow yet.
        Kind::Memory => Ok(InstallOutcome::Unsupported),
    }
}

fn write_file(path: &Path, body: &str, overwrite: bool) -> Result<InstallOutcome, String> {
    let exists = path.exists();
    if exists && !overwrite {
        return Ok(InstallOutcome::Exists);
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, body).map_err(|e| e.to_string())?;
    Ok(if exists {
        InstallOutcome::Overwritten
    } else {
        InstallOutcome::Created
    })
}

/// Append a rule as a new `## ` section. The body already begins with its own heading. If a section
/// with that heading already exists, we decline (replacing it is a merge — a later, hunk-level flow).
fn append_rule(claude_md: &Path, name: &str, body: &str) -> Result<InstallOutcome, String> {
    let existing = fs::read_to_string(claude_md).unwrap_or_default();
    let heading = format!("## {name}");
    if existing.lines().any(|l| l.trim() == heading) {
        return Ok(InstallOutcome::Unsupported); // heading exists → needs merge, not blind append
    }
    let mut next = existing.trim_end().to_string();
    if !next.is_empty() {
        next.push_str("\n\n");
    }
    next.push_str(body.trim());
    next.push('\n');
    if let Some(parent) = claude_md.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(claude_md, next).map_err(|e| e.to_string())?;
    Ok(InstallOutcome::Created)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tmp(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("evolve_install_{tag}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn creates_a_skill_file() {
        let root = tmp("skill");
        let outcome = install(&root, Kind::Skill, "foo", "BODY", false).unwrap();
        assert_eq!(outcome, InstallOutcome::Created);
        assert_eq!(fs::read_to_string(root.join("skills/foo/SKILL.md")).unwrap(), "BODY");
    }

    #[test]
    fn skips_existing_without_overwrite() {
        let root = tmp("skip");
        install(&root, Kind::Command, "c", "A", false).unwrap();
        let outcome = install(&root, Kind::Command, "c", "B", false).unwrap();
        assert_eq!(outcome, InstallOutcome::Exists);
        assert_eq!(fs::read_to_string(root.join("commands/c.md")).unwrap(), "A"); // unchanged
    }

    #[test]
    fn overwrites_when_asked() {
        let root = tmp("ow");
        install(&root, Kind::Agent, "a", "A", false).unwrap();
        let outcome = install(&root, Kind::Agent, "a", "B", true).unwrap();
        assert_eq!(outcome, InstallOutcome::Overwritten);
        assert_eq!(fs::read_to_string(root.join("agents/a.md")).unwrap(), "B");
    }

    #[test]
    fn appends_a_new_rule_but_declines_an_existing_heading() {
        let root = tmp("rule");
        fs::write(root.join("CLAUDE.md"), "# Title\n").unwrap();
        let first = install(&root, Kind::Rule, "My Rule", "## My Rule\nbody", false).unwrap();
        assert_eq!(first, InstallOutcome::Created);
        assert!(fs::read_to_string(root.join("CLAUDE.md")).unwrap().contains("## My Rule"));
        // second time the heading already exists → needs merge, not append
        let second = install(&root, Kind::Rule, "My Rule", "## My Rule\nnew", false).unwrap();
        assert_eq!(second, InstallOutcome::Unsupported);
    }

    #[test]
    fn rejects_unsafe_names() {
        let root = tmp("unsafe");
        assert!(install(&root, Kind::Skill, "../evil", "x", false).is_err());
    }
}
