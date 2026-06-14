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
        projects.push(Project {
            encoded,
            claude_dir,
            real_path,
        });
    }

    projects
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

/// Fallback: decode the encoded name (`-` → `/`) and keep it ONLY if that path actually exists.
/// Recovers simple paths (e.g. `-Users-auxia-gfs` → `/Users/auxia/gfs`); names with literal dashes
/// stay unresolved (we won't guess wrong).
fn decode_and_verify(encoded: &str) -> Option<String> {
    let candidate = encoded.replace('-', "/");
    if Path::new(&candidate).is_dir() {
        Some(candidate)
    } else {
        None
    }
}
