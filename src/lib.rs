//! evolve — scan a user's `~/.claude` config (skills, rules, auto-memory) into a uniform
//! inventory. This library holds all the logic; `main.rs` is a thin CLI over it, and a future
//! Tauri desktop app can depend on this same crate.

pub mod claude;
pub mod hash;
pub mod model;
pub mod render;

// Convenience re-export so callers can write `evolve::scan(...)`.
pub use claude::scan;
