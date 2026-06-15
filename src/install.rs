//! Writing config back into a Claude root — the counterpart to the read-only scanner, and the adopt
//! flow's writes. Atomic kinds (skill/command/agent) write a file; a rule is upserted as a `##`
//! section in CLAUDE.md. Names are sanitized so a write can never escape the destination. Existing
//! files are never clobbered unless `overwrite` is set — the caller decides after a preview.

use std::fs;
use std::path::{Path, PathBuf};

use crate::model::Kind;

/// Where to install: the dir holding `skills/commands/agents`, and the CLAUDE.md for rules.
/// These differ between global (`~/.claude` + `~/.claude/CLAUDE.md`) and a project
/// (`<proj>/.claude` + `<proj>/CLAUDE.md`), so we carry both explicitly.
pub struct Destination {
    pub config_dir: PathBuf,
    pub claude_md: PathBuf,
}

impl Destination {
    /// Global config: skills etc. live directly under the root, CLAUDE.md sits in it.
    pub fn global(root: &Path) -> Self {
        Self {
            config_dir: root.to_path_buf(),
            claude_md: root.join("CLAUDE.md"),
        }
    }

    /// A project checkout: skills live under `<proj>/.claude`, but CLAUDE.md is at `<proj>/CLAUDE.md`.
    pub fn project(real_path: &Path) -> Self {
        Self {
            config_dir: real_path.join(".claude"),
            claude_md: real_path.join("CLAUDE.md"),
        }
    }
}

/// What an install did (or declined to do).
#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub enum InstallOutcome {
    Created,
    Overwritten,
    /// Something with that identity already exists and `overwrite` was false — skipped.
    Exists,
    /// This kind can't be adopted (memory has no adopt flow).
    Unsupported,
}

/// Install one item into `dest`. Errors only on unsafe input or I/O.
pub fn install(
    dest: &Destination,
    kind: Kind,
    name: &str,
    body: &str,
    overwrite: bool,
) -> Result<InstallOutcome, String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("unsafe item name: {name:?}"));
    }
    match kind {
        Kind::Skill => write_file(
            &dest.config_dir.join("skills").join(name).join("SKILL.md"),
            body,
            overwrite,
        ),
        Kind::Command => write_file(
            &dest.config_dir.join("commands").join(format!("{name}.md")),
            body,
            overwrite,
        ),
        Kind::Agent => write_file(
            &dest.config_dir.join("agents").join(format!("{name}.md")),
            body,
            overwrite,
        ),
        Kind::Rule => upsert_rule(&dest.claude_md, name, body, overwrite),
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

/// Upsert a rule as a `## ` section. Body already begins with its own heading. If the heading exists
/// and `overwrite` is set, the whole section is replaced (the merge "take theirs"); without overwrite
/// an existing heading is skipped (the UI offers a merge preview first).
fn upsert_rule(
    claude_md: &Path,
    name: &str,
    body: &str,
    overwrite: bool,
) -> Result<InstallOutcome, String> {
    let existing = fs::read_to_string(claude_md).unwrap_or_default();
    let heading = format!("## {name}");
    let has = existing.lines().any(|l| l.trim() == heading);
    if has && !overwrite {
        return Ok(InstallOutcome::Exists);
    }

    let next = if has {
        replace_section(&existing, &heading, body.trim())
    } else {
        let mut s = existing.trim_end().to_string();
        if !s.is_empty() {
            s.push_str("\n\n");
        }
        s.push_str(body.trim());
        s.push('\n');
        s
    };

    if let Some(parent) = claude_md.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(claude_md, next).map_err(|e| e.to_string())?;
    Ok(if has {
        InstallOutcome::Overwritten
    } else {
        InstallOutcome::Created
    })
}

/// Replace the `heading` section (from its `## ` line up to the next `## ` or EOF) with `body`.
fn replace_section(existing: &str, heading: &str, body: &str) -> String {
    let mut out = String::new();
    let mut lines = existing.lines().peekable();
    while let Some(line) = lines.next() {
        if line.trim() == heading {
            out.push_str(body);
            out.push('\n');
            // skip the old section body until the next section heading
            while let Some(next) = lines.peek() {
                if next.starts_with("## ") {
                    break;
                }
                lines.next();
            }
        } else {
            out.push_str(line);
            out.push('\n');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("evolve_install_{tag}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn creates_a_skill_file() {
        let root = tmp("skill");
        let outcome = install(&Destination::global(&root), Kind::Skill, "foo", "BODY", false).unwrap();
        assert_eq!(outcome, InstallOutcome::Created);
        assert_eq!(fs::read_to_string(root.join("skills/foo/SKILL.md")).unwrap(), "BODY");
    }

    #[test]
    fn project_destination_uses_dot_claude_but_root_claude_md() {
        let proj = tmp("proj");
        let dest = Destination::project(&proj);
        install(&dest, Kind::Skill, "s", "X", false).unwrap();
        install(&dest, Kind::Rule, "R", "## R\nbody", false).unwrap();
        assert!(proj.join(".claude/skills/s/SKILL.md").exists()); // skill under .claude
        assert!(proj.join("CLAUDE.md").exists()); // rule in the repo-root CLAUDE.md
    }

    #[test]
    fn skips_existing_without_overwrite() {
        let root = tmp("skip");
        let dest = Destination::global(&root);
        install(&dest, Kind::Command, "c", "A", false).unwrap();
        let outcome = install(&dest, Kind::Command, "c", "B", false).unwrap();
        assert_eq!(outcome, InstallOutcome::Exists);
        assert_eq!(fs::read_to_string(root.join("commands/c.md")).unwrap(), "A");
    }

    #[test]
    fn overwrites_a_file_when_asked() {
        let root = tmp("ow");
        let dest = Destination::global(&root);
        install(&dest, Kind::Agent, "a", "A", false).unwrap();
        let outcome = install(&dest, Kind::Agent, "a", "B", true).unwrap();
        assert_eq!(outcome, InstallOutcome::Overwritten);
        assert_eq!(fs::read_to_string(root.join("agents/a.md")).unwrap(), "B");
    }

    #[test]
    fn appends_new_rule_then_replaces_on_overwrite() {
        let root = tmp("rule");
        let dest = Destination::global(&root);
        fs::write(root.join("CLAUDE.md"), "# Title\n\n## Other\nkeep me\n").unwrap();

        assert_eq!(
            install(&dest, Kind::Rule, "My Rule", "## My Rule\nv1", false).unwrap(),
            InstallOutcome::Created
        );
        // exists, no overwrite → skipped
        assert_eq!(
            install(&dest, Kind::Rule, "My Rule", "## My Rule\nv2", false).unwrap(),
            InstallOutcome::Exists
        );
        // overwrite → section replaced, neighbour section intact
        assert_eq!(
            install(&dest, Kind::Rule, "My Rule", "## My Rule\nv2", true).unwrap(),
            InstallOutcome::Overwritten
        );
        let c = fs::read_to_string(root.join("CLAUDE.md")).unwrap();
        assert!(c.contains("v2") && !c.contains("v1"));
        assert!(c.contains("## Other") && c.contains("keep me"));
    }

    #[test]
    fn rejects_unsafe_names() {
        let root = tmp("unsafe");
        assert!(install(&Destination::global(&root), Kind::Skill, "../evil", "x", false).is_err());
    }
}
