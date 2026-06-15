//! Persist the Supabase refresh token so the user stays signed in across launches.
//!
//! Stored as a JSON file in the OS app-data dir (`~/Library/Application Support/io.evolve.app/` on
//! macOS) — no keychain prompt. Tradeoff (deliberate): the token sits on disk, readable by processes
//! running as the user, like the gh / npm / aws CLIs. Only the refresh token is kept (never the
//! short-lived access token). A signed release can move this back to the keychain later.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const APP_DIR: &str = "io.evolve.app";
const FILE: &str = "session.json";

#[derive(Serialize, Deserialize)]
struct Stored {
    refresh_token: String,
}

fn session_path() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join(APP_DIR).join(FILE))
}

/// Save (or overwrite) the refresh token. Called after sign-in and after every refresh (it rotates).
pub fn save(token: &str) -> Result<(), String> {
    let path = session_path().ok_or("no app-data directory")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&Stored {
        refresh_token: token.to_string(),
    })
    .map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

/// The stored refresh token, if any. `None` means "never signed in" (or signed out).
pub fn load() -> Option<String> {
    let text = fs::read_to_string(session_path()?).ok()?;
    serde_json::from_str::<Stored>(&text)
        .ok()
        .map(|s| s.refresh_token)
}

/// Forget the stored token (sign-out, or when a refresh is rejected).
pub fn clear() {
    if let Some(path) = session_path() {
        let _ = fs::remove_file(path);
    }
}
