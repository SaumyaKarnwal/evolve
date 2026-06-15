//! Google sign-in via Supabase, the desktop way: OAuth Authorization Code + PKCE.
//!
//! Flow: generate a PKCE pair → start a loopback server on 127.0.0.1:8788 → open the system browser
//! to Supabase's authorize URL (Google can't run in an embedded webview) → catch the `?code=…`
//! redirect on the loopback → exchange code + verifier for a session. PKCE means we never need a
//! client secret a desktop app couldn't keep: a stolen code is useless without the in-memory verifier.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::config::SupabaseConfig;

const REDIRECT_PORT: u16 = 8788;
const REDIRECT_URL: &str = "http://localhost:8788";

/// A signed-in session as returned by Supabase's token endpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct Session {
    pub access_token: String,
    pub refresh_token: String,
    pub user: User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: Option<String>,
    #[serde(default)]
    pub user_metadata: serde_json::Value,
}

/// The PKCE pair: the secret kept in memory + the hash sent over the wire.
struct Pkce {
    verifier: String,
    challenge: String,
}

fn make_pkce() -> Pkce {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).expect("system RNG unavailable");
    let verifier = URL_SAFE_NO_PAD.encode(bytes);
    let challenge = URL_SAFE_NO_PAD.encode(evolve::hash::sha256_bytes(&verifier));
    Pkce {
        verifier,
        challenge,
    }
}

fn authorize_url(cfg: &SupabaseConfig, challenge: &str) -> String {
    format!(
        "{}/authorize?provider=google&redirect_to={}&code_challenge={}&code_challenge_method=s256",
        cfg.auth_url(),
        urlencoding::encode(REDIRECT_URL),
        challenge,
    )
}

/// Run the whole sign-in. Binds the loopback *before* opening the browser so we can't miss the redirect.
pub async fn sign_in(cfg: &SupabaseConfig) -> Result<Session, String> {
    let pkce = make_pkce();
    let listener = TcpListener::bind(("127.0.0.1", REDIRECT_PORT))
        .await
        .map_err(|e| format!("couldn't start the loopback server on {REDIRECT_PORT}: {e}"))?;

    open::that(authorize_url(cfg, &pkce.challenge))
        .map_err(|e| format!("couldn't open the browser: {e}"))?;

    let code = accept_code(listener).await?;
    exchange_code(cfg, &pkce.verifier, &code).await
}

/// Exchange the PKCE refresh token for a fresh session (called when an access token has expired).
pub async fn refresh(cfg: &SupabaseConfig, refresh_token: &str) -> Result<Session, String> {
    let resp = reqwest::Client::new()
        .post(format!("{}/token?grant_type=refresh_token", cfg.auth_url()))
        .header("apikey", &cfg.anon_key)
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    parse_session(resp).await
}

/// Wait for the single OAuth redirect, read the `code` out of it, and reply with a friendly page.
async fn accept_code(listener: TcpListener) -> Result<String, String> {
    let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;

    let mut buf = vec![0u8; 8192];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);
    // request line looks like: GET /?code=XYZ&... HTTP/1.1
    let target = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("");
    let code = query_param(target, "code");

    let message = if code.is_some() {
        "<h2>Signed in to Evolve</h2><p>You can close this tab and return to the app.</p>"
    } else {
        "<h2>Sign-in failed</h2><p>You can close this tab and try again from the app.</p>"
    };
    let page = format!(
        "<html><body style='font-family:system-ui;max-width:32rem;margin:4rem auto;color:#211c16'>{message}</body></html>"
    );
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        page.len(),
        page,
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;

    code.ok_or_else(|| {
        query_param(target, "error_description")
            .or_else(|| query_param(target, "error"))
            .unwrap_or_else(|| "no authorization code in the redirect".to_string())
    })
}

async fn exchange_code(
    cfg: &SupabaseConfig,
    verifier: &str,
    code: &str,
) -> Result<Session, String> {
    let resp = reqwest::Client::new()
        .post(format!("{}/token?grant_type=pkce", cfg.auth_url()))
        .header("apikey", &cfg.anon_key)
        .json(&serde_json::json!({ "auth_code": code, "code_verifier": verifier }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    parse_session(resp).await
}

async fn parse_session(resp: reqwest::Response) -> Result<Session, String> {
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("auth {status}: {text}"));
    }
    serde_json::from_str(&text).map_err(|e| format!("decode session: {e} — body: {text}"))
}

/// Pull one query parameter out of a request target (`/?a=1&b=2`), percent-decoded.
fn query_param(target: &str, key: &str) -> Option<String> {
    let query = target.split('?').nth(1)?;
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == key).then(|| urlencoding::decode(v).map(|s| s.into_owned()).unwrap_or_default())
    })
}
