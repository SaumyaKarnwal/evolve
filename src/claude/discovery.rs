//! Discover Claude projects and resolve each to its real working directory.
//! The `~/.claude/projects/<dir>` name encodes the path lossily, so we read the true `cwd` from a
//! transcript; if there's no transcript, we fall back to decoding the name and verifying on disk.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

/// One transcript line. Transcripts have many fields; we declare only `cwd` (serde ignores the rest).
#[derive(Deserialize)]
struct TranscriptLine {
    cwd: Option<String>,
}

/// A discovered project: the encoded dir name, its `~/.claude/projects/<dir>` path (where auto-memory
/// lives), and the resolved real working directory (where project-local config lives), if known.
pub struct Project {
    pub encoded: String,
    pub claude_dir: PathBuf,
    pub real_path: Option<String>,
}

/// List every project under `~/.claude/projects`, resolving each real path best-effort.
pub fn discover_projects(claude_root: &Path) -> Vec<Project> {
    let mut projects = Vec::new();

    let entries = match fs::read_dir(claude_root.join("projects")) {
        Ok(entries) => entries,
        Err(_) => return projects,
    };

    for entry in entries.flatten() {
        let claude_dir = entry.path();
        if !claude_dir.is_dir() {
            continue;
        }
        let encoded = entry.file_name().to_string_lossy().into_owned();
        // transcript cwd is authoritative; decode-and-verify is the fallback.
        let real_path =
            resolve_from_transcript(&claude_dir).or_else(|| decode_and_verify(&encoded));
        // Skip git worktrees: they're temporary checkouts whose config is a copy of the parent
        // repo, so scanning them would show the same skills/rules once per worktree.
        if is_worktree(&encoded, real_path.as_deref()) {
            continue;
        }
        projects.push(Project {
            encoded,
            claude_dir,
            real_path,
        });
    }

    projects
}

/// True for a project living under `<repo>/.claude/worktrees/<name>`. Matched on the resolved path
/// when we have it, falling back to the encoded dir name so deleted-worktree leftovers are caught too.
fn is_worktree(encoded: &str, real_path: Option<&str>) -> bool {
    real_path.is_some_and(|p| p.contains("/.claude/worktrees/"))
        || encoded.contains("claude-worktrees")
}

/// Read the real `cwd` out of any transcript in the project dir (authoritative; works on any machine).
fn resolve_from_transcript(project_dir: &Path) -> Option<String> {
    let entries = fs::read_dir(project_dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
            continue; // only transcript files
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue; // unreadable transcript — try the next
        };
        for line in content.lines() {
            if let Ok(TranscriptLine { cwd: Some(cwd) }) =
                serde_json::from_str::<TranscriptLine>(line)
            {
                return Some(cwd);
            }
        }
    }
    None
}

/// Fallback when there's no transcript: reverse the lossy `/`→`-` encoding by probing the filesystem.
///
/// The encoding maps both `/` and literal `-` to `-`, so the name alone is ambiguous
/// (`-Users-auxia-claude-workflow-dashboard` could be `…/claude/workflow/dashboard` OR
/// `…/claude-workflow-dashboard`). We resolve it by asking the disk which interpretation is real,
/// preferring to treat each `-` as a separator and merging tokens into one segment only when the
/// separated form doesn't exist. Returns a path only if every segment exists, so we never guess wrong.
fn decode_and_verify(encoded: &str) -> Option<String> {
    resolve_encoded(encoded, &|p| Path::new(p).is_dir())
}

/// The pure core of [`decode_and_verify`]: `exists` is the directory predicate (the filesystem in
/// production, a fixed set in tests).
fn resolve_encoded(encoded: &str, exists: &dyn Fn(&str) -> bool) -> Option<String> {
    let tokens: Vec<&str> = encoded.trim_start_matches('-').split('-').collect();
    if tokens.iter().all(|t| t.is_empty()) {
        return None;
    }
    walk_segments("", &tokens, exists)
}

/// Consume `tokens` into path segments under `base`, trying a separator first (fewest merges) and
/// backtracking to merge tokens with `-` when a segment doesn't exist on disk.
fn walk_segments(base: &str, tokens: &[&str], exists: &dyn Fn(&str) -> bool) -> Option<String> {
    if tokens.is_empty() {
        return Some(base.to_string());
    }
    for take in 1..=tokens.len() {
        let segment = tokens[..take].join("-");
        let candidate = format!("{base}/{segment}");
        if exists(&candidate) {
            if let Some(found) = walk_segments(&candidate, &tokens[take..], exists) {
                return Some(found);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A name that decodes to a real directory resolves to that path (`-usr` → `/usr`, which exists).
    #[test]
    fn decodes_name_that_maps_to_real_dir() {
        assert_eq!(decode_and_verify("-usr"), Some("/usr".to_string()));
    }

    /// A name that decodes to a path that doesn't exist stays unresolved — we never guess wrong.
    #[test]
    fn leaves_nonexistent_path_unresolved() {
        assert_eq!(decode_and_verify("-no-such-dir-evolve-test-xyz"), None);
    }

    /// Probing recovers a folder whose own name contains dashes (the case transcripts would miss).
    #[test]
    fn probes_filesystem_to_resolve_dashed_names() {
        let real = ["/Users", "/Users/auxia", "/Users/auxia/claude-workflow-dashboard"];
        let exists = |p: &str| real.contains(&p);
        assert_eq!(
            resolve_encoded("-Users-auxia-claude-workflow-dashboard", &exists),
            Some("/Users/auxia/claude-workflow-dashboard".to_string()),
        );
    }

    /// When both a separated and a merged interpretation exist, the separator wins.
    #[test]
    fn prefers_separator_when_both_interpretations_exist() {
        let real = ["/Users", "/Users/x", "/Users/x/a", "/Users/x/a/b", "/Users/x/a-b"];
        let exists = |p: &str| real.contains(&p);
        assert_eq!(resolve_encoded("-Users-x-a-b", &exists), Some("/Users/x/a/b".to_string()));
    }

    /// Tokens are merged into one segment only when the separated form is absent.
    #[test]
    fn merges_tokens_only_when_separated_form_absent() {
        let real = ["/Users", "/Users/x", "/Users/x/a-b"]; // a/b does NOT exist
        let exists = |p: &str| real.contains(&p);
        assert_eq!(resolve_encoded("-Users-x-a-b", &exists), Some("/Users/x/a-b".to_string()));
    }

    /// Nothing on disk → no guess.
    #[test]
    fn resolve_encoded_returns_none_when_nothing_exists() {
        assert_eq!(resolve_encoded("-a-b-c", &|_| false), None);
    }

    /// Worktrees are recognized by their resolved path, by encoded name when the path is gone, and
    /// plain repos are never mistaken for one.
    #[test]
    fn recognizes_worktrees() {
        assert!(is_worktree(
            "-Users-auxia-source--claude-worktrees-brand-voice",
            Some("/Users/auxia/source/.claude/worktrees/brand-voice"),
        ));
        assert!(is_worktree("-Users-auxia-source--claude-worktrees-gone", None));
        assert!(!is_worktree("-Users-auxia-source", Some("/Users/auxia/source")));
        assert!(!is_worktree("-Users-auxia", Some("/Users/auxia")));
    }
}
