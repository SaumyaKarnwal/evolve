//! Reusable parsers. Each turns a place on disk into items; the adapter applies them to both global
//! and project-local locations. All `~/.claude` path knowledge lives in this module + `discovery` (D3).

use std::fs;
use std::path::Path;

use crate::hash::sha256;
use crate::model::{Kind, ScannedItem, Scope};

/// Every subdirectory of `dir` that contains a `SKILL.md` → one `Skill` item (e.g. `~/.claude/skills`).
pub fn scan_skill_dir(dir: &Path, scope: &Scope) -> Vec<ScannedItem> {
    let mut items = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return items,
    };
    for entry in entries.flatten() {
        let skill_md = entry.path().join("SKILL.md");
        if let Ok(body) = fs::read_to_string(&skill_md) {
            let name = entry.file_name().to_string_lossy().into_owned();
            items.push(item(Kind::Skill, name, scope, body));
        }
    }
    items
}

/// Every `*.md` file directly in `dir` → one item of `kind` (memory / commands / agents).
pub fn scan_md_files(dir: &Path, kind: Kind, scope: &Scope) -> Vec<ScannedItem> {
    let mut items = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return items,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
            continue;
        }
        if let Ok(body) = fs::read_to_string(&path) {
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            items.push(item(kind, name, scope, body));
        }
    }
    items
}

/// Split a `CLAUDE.md` into one `rule` per `## ` section (named by its heading). Deterministic — it
/// just follows the file's own headings; no AI. A file with no `## ` headings becomes a single
/// whole-file rule, so nothing is ever lost. Rules are never merged across files (no clubbing).
pub fn scan_claude_md(path: &Path, scope: &Scope) -> Vec<ScannedItem> {
    let body = match fs::read_to_string(path) {
        Ok(body) => body,
        Err(_) => return Vec::new(),
    };

    let mut items = Vec::new();
    let mut heading: Option<String> = None;
    let mut section = String::new();
    let mut preamble = String::new();

    for line in body.lines() {
        if let Some(title) = line.strip_prefix("## ") {
            flush_rule(&mut items, heading.take(), &section, scope);
            heading = Some(title.trim().to_string());
            section.clear();
            section.push_str(line);
            section.push('\n');
        } else if heading.is_some() {
            section.push_str(line);
            section.push('\n');
        } else {
            preamble.push_str(line);
            preamble.push('\n');
        }
    }
    flush_rule(&mut items, heading.take(), &section, scope);

    // Content before the first `## ` (e.g. just a `# Title`) — keep it only if it has real content,
    // so a heading-less CLAUDE.md still yields one whole rule instead of being dropped.
    if preamble
        .lines()
        .any(|l| !l.trim().is_empty() && !l.starts_with('#'))
    {
        let title = preamble
            .lines()
            .find_map(|l| l.strip_prefix("# "))
            .map(|t| t.trim().to_string())
            .unwrap_or_else(|| "Overview".to_string());
        items.insert(0, rule_item(title, preamble.trim(), scope));
    }

    items
}

/// Push a rule for one section, unless it's empty.
fn flush_rule(items: &mut Vec<ScannedItem>, heading: Option<String>, body: &str, scope: &Scope) {
    if let Some(heading) = heading {
        let trimmed = body.trim();
        if !trimmed.is_empty() {
            items.push(rule_item(heading, trimmed, scope));
        }
    }
}

/// A rule item carries its section heading as `source_anchor` (traceable back to the file + section).
fn rule_item(heading: String, body: &str, scope: &Scope) -> ScannedItem {
    ScannedItem {
        kind: Kind::Rule,
        name: heading.clone(),
        scope: scope.clone(),
        source_anchor: Some(heading),
        content_hash: sha256(body),
        body: body.to_string(),
    }
}

/// Build one atomic item (skill/memory/command/agent) — no section anchor.
fn item(kind: Kind, name: String, scope: &Scope, body: String) -> ScannedItem {
    ScannedItem {
        kind,
        name,
        scope: scope.clone(),
        source_anchor: None,
        content_hash: sha256(&body),
        body,
    }
}
