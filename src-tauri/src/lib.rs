mod auth;
mod config;
mod registry;

use std::sync::Mutex;

use config::SupabaseConfig;

/// App-wide state: the (optional) Supabase config loaded at startup, and the in-memory session.
/// v1 keeps the session in memory only — you sign in once per launch (persistent keychain login later).
struct AppState {
    config: Option<SupabaseConfig>,
    session: Mutex<Option<auth::Session>>,
}

/// What the UI needs about the signed-in user.
#[derive(Clone, serde::Serialize)]
struct UserInfo {
    email: Option<String>,
    name: Option<String>,
}

fn user_info(session: &auth::Session) -> UserInfo {
    let name = session
        .user
        .user_metadata
        .get("name")
        .and_then(|v| v.as_str())
        .map(String::from);
    UserInfo {
        email: session.user.email.clone(),
        name,
    }
}

// ---- helpers: token retrieval + refresh (never hold the lock across an await) ----

fn current_token(state: &AppState) -> Result<String, String> {
    state
        .session
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.access_token.clone())
        .ok_or_else(|| "Not signed in".to_string())
}

async fn refresh_token(state: &AppState, cfg: &SupabaseConfig) -> Result<String, String> {
    let refresh = state
        .session
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.refresh_token.clone())
        .ok_or_else(|| "Not signed in".to_string())?;
    let session = auth::refresh(cfg, &refresh).await?;
    let token = session.access_token.clone();
    *state.session.lock().unwrap() = Some(session);
    Ok(token)
}

fn is_auth_err(e: &str) -> bool {
    e.contains("401") || e.contains("invalid_grant") || e.contains("JWT")
}

fn require_config(state: &AppState) -> Result<SupabaseConfig, String> {
    state
        .config
        .clone()
        .ok_or_else(|| "Remote not configured — evolve.config.json is missing".to_string())
}

// ---- commands ----

/// Scan the user's ~/.claude and return all items to the UI.
#[tauri::command]
fn scan() -> Vec<evolve::model::ScannedItem> {
    evolve::default_claude_root()
        .map(|root| evolve::scan(&root))
        .unwrap_or_default()
}

#[tauri::command]
async fn sign_in_google(state: tauri::State<'_, AppState>) -> Result<UserInfo, String> {
    let cfg = require_config(&state)?;
    let session = auth::sign_in(&cfg).await?;
    let info = user_info(&session);
    *state.session.lock().unwrap() = Some(session);
    Ok(info)
}

#[tauri::command]
fn sign_out(state: tauri::State<'_, AppState>) {
    *state.session.lock().unwrap() = None;
}

#[tauri::command]
fn current_user(state: tauri::State<'_, AppState>) -> Option<UserInfo> {
    state.session.lock().unwrap().as_ref().map(user_info)
}

#[tauri::command]
async fn publish_item(
    state: tauri::State<'_, AppState>,
    kind: String,
    name: String,
    hash: String,
    body: String,
    anchor: Option<String>,
) -> Result<registry::Publication, String> {
    let cfg = require_config(&state)?;
    let input = registry::PublishInput {
        kind,
        name,
        hash,
        body,
        anchor,
    };
    let token = current_token(state.inner())?;
    match registry::publish(&cfg, &token, &input).await {
        Err(e) if is_auth_err(&e) => {
            let token = refresh_token(state.inner(), &cfg).await?;
            registry::publish(&cfg, &token, &input).await
        }
        other => other,
    }
}

#[tauri::command]
async fn unpublish_item(
    state: tauri::State<'_, AppState>,
    kind: String,
    name: String,
) -> Result<(), String> {
    let cfg = require_config(&state)?;
    let token = current_token(state.inner())?;
    match registry::unpublish(&cfg, &token, &kind, &name).await {
        Err(e) if is_auth_err(&e) => {
            let token = refresh_token(state.inner(), &cfg).await?;
            registry::unpublish(&cfg, &token, &kind, &name).await
        }
        other => other,
    }
}

#[tauri::command]
async fn list_publications(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<registry::Publication>, String> {
    let cfg = require_config(&state)?;
    let token = current_token(state.inner())?;
    match registry::my_publications(&cfg, &token).await {
        Err(e) if is_auth_err(&e) => {
            let token = refresh_token(state.inner(), &cfg).await?;
            registry::my_publications(&cfg, &token).await
        }
        other => other,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            config: SupabaseConfig::load(),
            session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            scan,
            sign_in_google,
            sign_out,
            current_user,
            publish_item,
            unpublish_item,
            list_publications,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
