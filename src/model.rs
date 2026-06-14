//! Core data types — what a scanned item *is*.

/// What kind of config artifact an item is — exactly one of these (an enum, not a free string,
/// so typos can't compile and a `match` on it is exhaustive).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Skill,
    Rule,
    Memory,
    Command,
    Agent,
}

impl Kind {
    /// Lowercase label used in output. Takes `self` by value (the enum is `Copy`).
    pub fn label(self) -> &'static str {
        match self {
            Kind::Skill => "skill",
            Kind::Rule => "rule",
            Kind::Memory => "memory",
            Kind::Command => "command",
            Kind::Agent => "agent",
        }
    }
}

/// Where an item lives: globally under `~/.claude`, or scoped to one Claude project.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    Global,
    /// A Claude project. `encoded` is the `~/.claude/projects/<dir>` name; `real_path` is the
    /// working directory resolved from the transcript `cwd` (None if it couldn't be resolved).
    Project {
        encoded: String,
        real_path: Option<String>,
    },
}

/// The uniform item (D2): every kind is the same shape, with an opaque `body`.
#[derive(Debug, Clone)]
pub struct ScannedItem {
    pub kind: Kind,
    pub name: String,
    pub scope: Scope,
    /// For a rule split out of a `CLAUDE.md`: the `##` section heading it came from.
    /// `None` for atomic items (skills, memory, commands, agents).
    pub source_anchor: Option<String>,
    pub body: String,
    pub content_hash: String,
}
