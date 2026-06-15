//! Registry client — the desktop app's calls into the Supabase Data API.
//!
//! The entire surface is three RPCs (`publish_item`, `unpublish_item`, `my_publications`); we never
//! touch tables directly. Every call carries the publishable anon key plus the signed-in user's JWT,
//! so the functions' `auth.uid()` checks scope every operation to that user.

use serde::{Deserialize, Serialize};

use crate::config::SupabaseConfig;

/// A publication row as returned by the RPCs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Publication {
    pub id: String,
    pub owner_id: String,
    pub kind: String,
    pub name: String,
    pub visibility: String,
    pub latest_revision: i64,
    pub current_hash: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// A public publication from someone (the Discover feed): author + latest content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicItem {
    pub id: String,
    pub owner_name: Option<String>,
    pub kind: String,
    pub name: String,
    pub latest_revision: i64,
    pub body: String,
    pub updated_at: String,
}

/// What to publish: the item's identity plus its current content.
#[derive(Debug, Clone)]
pub struct PublishInput {
    pub kind: String,
    pub name: String,
    pub hash: String,
    pub body: String,
    pub anchor: Option<String>,
}

fn rpc_url(cfg: &SupabaseConfig, name: &str) -> String {
    format!("{}/rpc/{}", cfg.rest_url(), name)
}

/// Publish, or append a revision when the content changed. Unchanged content is a no-op server-side.
pub async fn publish(
    cfg: &SupabaseConfig,
    access_token: &str,
    input: &PublishInput,
) -> Result<Publication, String> {
    let payload = serde_json::json!({
        // the Postgres item_kind enum is lowercase ('skill', …); our Kind serializes as 'Skill'
        "p_kind": input.kind.to_lowercase(),
        "p_name": input.name,
        "p_hash": input.hash,
        "p_body": input.body,
        "p_anchor": input.anchor,
    });
    let resp = reqwest::Client::new()
        .post(rpc_url(cfg, "publish_item"))
        .header("apikey", &cfg.anon_key)
        .bearer_auth(access_token)
        // ask PostgREST for a single object rather than a one-element array
        .header("Accept", "application/vnd.pgrst.object+json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let text = expect_success(resp).await?;
    serde_json::from_str(&text).map_err(|e| format!("decode publication: {e} — body: {text}"))
}

/// Remove a publication from the registry entirely.
pub async fn unpublish(
    cfg: &SupabaseConfig,
    access_token: &str,
    kind: &str,
    name: &str,
) -> Result<(), String> {
    let payload = serde_json::json!({ "p_kind": kind.to_lowercase(), "p_name": name });
    let resp = reqwest::Client::new()
        .post(rpc_url(cfg, "unpublish_item"))
        .header("apikey", &cfg.anon_key)
        .bearer_auth(access_token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    expect_success(resp).await.map(|_| ())
}

/// Everything the current user has published (drives the "published" + drift indicators).
pub async fn my_publications(
    cfg: &SupabaseConfig,
    access_token: &str,
) -> Result<Vec<Publication>, String> {
    let resp = reqwest::Client::new()
        .post(rpc_url(cfg, "my_publications"))
        .header("apikey", &cfg.anon_key)
        .bearer_auth(access_token)
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let text = expect_success(resp).await?;
    serde_json::from_str(&text).map_err(|e| format!("decode publications: {e} — body: {text}"))
}

/// Browse everyone's public publications (the Discover feed).
pub async fn browse_public(
    cfg: &SupabaseConfig,
    access_token: &str,
) -> Result<Vec<PublicItem>, String> {
    let resp = reqwest::Client::new()
        .post(rpc_url(cfg, "browse_public"))
        .header("apikey", &cfg.anon_key)
        .bearer_auth(access_token)
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let text = expect_success(resp).await?;
    serde_json::from_str(&text).map_err(|e| format!("decode public items: {e} — body: {text}"))
}

/// Return the response body on 2xx, else a descriptive error that includes the server's message.
async fn expect_success(resp: reqwest::Response) -> Result<String, String> {
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if status.is_success() {
        Ok(text)
    } else {
        Err(format!("registry {status}: {text}"))
    }
}
