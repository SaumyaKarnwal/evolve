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
    match fs::read_to_string(path) {
        Ok(body) => parse_claude_md(&body, scope),
        Err(_) => Vec::new(),
    }
}

/// The pure heading-split (no I/O) behind [`scan_claude_md`] — given the file contents, produce the
/// rules. Kept separate so the splitting rules are unit-testable without touching the filesystem.
pub fn parse_claude_md(body: &str, scope: &Scope) -> Vec<ScannedItem> {
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

/// Push a rule for one section, unless the heading has no content under it. `body` always begins with
/// the `## ` heading line, so emptiness is judged by whether any *later* line is non-blank — otherwise
/// a bare `## Heading` would emit a junk rule whose whole body is just the heading.
fn flush_rule(items: &mut Vec<ScannedItem>, heading: Option<String>, body: &str, scope: &Scope) {
    if let Some(heading) = heading {
        let trimmed = body.trim();
        let has_content = trimmed.lines().skip(1).any(|l| !l.trim().is_empty());
        if has_content {
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Each `## ` heading becomes its own rule, named and anchored by that heading, in file order.
    #[test]
    fn splits_each_heading_into_its_own_rule() {
        let md = "# Title\n\n## Alpha\nfirst rule\n\n## Beta\nsecond rule\n";
        let items = parse_claude_md(md, &Scope::Global);

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Alpha");
        assert_eq!(items[1].name, "Beta");
        // Every rule is traceable back to its source section.
        assert_eq!(items[0].source_anchor.as_deref(), Some("Alpha"));
        assert_eq!(items[0].kind, Kind::Rule);
        // The section body retains its own heading line.
        assert!(items[0].body.contains("## Alpha"));
        assert!(items[0].body.contains("first rule"));
    }

    /// A `## ` heading with no content under it is dropped — we never emit empty rules.
    #[test]
    fn drops_empty_sections() {
        let md = "## Empty\n\n## HasBody\ncontent\n";
        let items = parse_claude_md(md, &Scope::Global);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "HasBody");
    }

    /// A file with no `## ` headings but a `# Title` + body becomes one whole-file rule named by the title.
    #[test]
    fn heading_less_file_with_title_yields_one_rule_named_by_title() {
        let md = "# My Project\n\nsome guidance with no subsections\n";
        let items = parse_claude_md(md, &Scope::Global);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "My Project");
        assert!(items[0].body.contains("some guidance"));
    }

    /// No headings at all and no `# Title` → still one rule, defaulted to "Overview" (nothing is lost).
    #[test]
    fn heading_less_file_without_title_defaults_to_overview() {
        let md = "just a bare instruction, no markdown headings\n";
        let items = parse_claude_md(md, &Scope::Global);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Overview");
    }

    /// Real content before the first `## ` is preserved as a leading rule, not silently dropped.
    #[test]
    fn preamble_before_first_heading_is_kept_first() {
        let md = "# Title\n\nintro paragraph that matters\n\n## Section\nbody\n";
        let items = parse_claude_md(md, &Scope::Global);

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Title");
        assert!(items[0].body.contains("intro paragraph"));
        assert_eq!(items[1].name, "Section");
    }

    /// A preamble that is only a `# Title` (no real content) is NOT kept — it would be an empty rule.
    #[test]
    fn title_only_preamble_is_not_kept() {
        let md = "# Title\n\n## Section\nbody\n";
        let items = parse_claude_md(md, &Scope::Global);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "Section");
    }

    /// The content hash is taken over the trimmed section body, so trailing whitespace never changes it.
    #[test]
    fn content_hash_matches_trimmed_body() {
        let md = "## Section\nbody line\n\n\n";
        let items = parse_claude_md(md, &Scope::Global);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].content_hash, sha256(items[0].body.trim()));
        assert_eq!(items[0].content_hash, sha256(&items[0].body));
    }
}
