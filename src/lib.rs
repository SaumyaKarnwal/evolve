//! evolve — scan a user's `~/.claude` config (skills, rules, auto-memory) into a uniform
//! inventory. This library holds all the logic; `main.rs` is a thin CLI over it, and a future
//! Tauri desktop app can depend on this same crate.

pub mod claude;
pub mod hash;
pub mod install;
pub mod model;
pub mod render;

// Convenience re-export so callers can write `evolve::scan(...)`.
pub use claude::scan;

/// The default Claude config root: `~/.claude` (None if the home directory can't be found).
/// Shared by the CLI and the desktop app so neither hardcodes a path.
pub fn default_claude_root() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|home| home.join(".claude"))
}
