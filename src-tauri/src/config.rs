//! Supabase connection config — the Project URL + publishable anon key.
//!
//! Loaded from the `EVOLVE_SUPABASE_URL` / `EVOLVE_SUPABASE_ANON_KEY` env vars, or from a gitignored
//! `evolve.config.json`. The anon key is designed to ship in clients (RLS protects the data), but we
//! still keep it out of the repo. `None` means "remote not configured yet" — the app runs local-only.

use std::path::{Path, PathBuf};

use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
}

impl SupabaseConfig {
    /// Load from env first, then the first readable `evolve.config.json` candidate. `None` if unset.
    pub fn load() -> Option<SupabaseConfig> {
        if let (Ok(url), Ok(anon_key)) = (
            std::env::var("EVOLVE_SUPABASE_URL"),
            std::env::var("EVOLVE_SUPABASE_ANON_KEY"),
        ) {
            if !url.is_empty() && !anon_key.is_empty() {
                return Some(SupabaseConfig { url, anon_key });
            }
        }
        candidate_paths()
            .into_iter()
            .find_map(|p| Self::load_from(&p))
    }

    /// Load config from one specific file (used to read the bundled resource copy in a
    /// packaged app, where the cwd-relative candidates don't exist). `None` if absent/invalid.
    pub fn load_from(path: &Path) -> Option<SupabaseConfig> {
        let text = std::fs::read_to_string(path).ok()?;
        serde_json::from_str::<SupabaseConfig>(&text).ok()
    }

    /// Base for PostgREST table/RPC calls, e.g. `<url>/rest/v1`.
    pub fn rest_url(&self) -> String {
        format!("{}/rest/v1", self.url.trim_end_matches('/'))
    }

    /// Base for the GoTrue auth API, e.g. `<url>/auth/v1`.
    pub fn auth_url(&self) -> String {
        format!("{}/auth/v1", self.url.trim_end_matches('/'))
    }
}

/// Where we look for `evolve.config.json`: an explicit override, the cwd, then the repo root
/// (one level above `src-tauri`, where `cargo tauri dev` typically runs).
fn candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(explicit) = std::env::var("EVOLVE_CONFIG") {
        paths.push(PathBuf::from(explicit));
    }
    paths.push(PathBuf::from("evolve.config.json"));
    paths.push(PathBuf::from("../evolve.config.json"));
    paths
}
