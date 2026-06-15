//! Local record of what you've adopted and from where — so we can flag "update available" when the
//! source publishes a newer revision. Stored as a JSON file in the app-data dir (no backend needed).

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const APP_DIR: &str = "io.evolve.app";
const FILE: &str = "adopted.json";

/// One adoption: the source publication id + the revision you took, keyed by what you wrote locally.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Adopted {
    pub source_id: String,
    pub kind: String,
    pub name: String,
    pub revision: i64,
}

fn path() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join(APP_DIR).join(FILE))
}

/// Everything adopted so far.
pub fn list() -> Vec<Adopted> {
    path()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

/// Record (or update) an adoption, replacing any prior entry for the same local kind+name.
pub fn record(entry: Adopted) {
    let mut all = list();
    all.retain(|x| !(x.kind == entry.kind && x.name == entry.name));
    all.push(entry);
    if let Some(p) = path() {
        if let Some(parent) = p.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string(&all) {
            let _ = fs::write(p, json);
        }
    }
}
