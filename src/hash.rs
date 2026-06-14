//! Content hashing.

use sha2::{Digest, Sha256};

/// SHA-256 of some text, as a lowercase hex string.
pub fn sha256(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hex::encode(hasher.finalize())
}
