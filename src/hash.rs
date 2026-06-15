//! Content hashing.

use sha2::{Digest, Sha256};

/// SHA-256 of some text, as a lowercase hex string.
pub fn sha256(text: &str) -> String {
    hex::encode(sha256_bytes(text))
}

/// SHA-256 of some text as raw bytes (used for the PKCE code-challenge: base64url of this).
pub fn sha256_bytes(text: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hasher.finalize().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pin against the published SHA-256 vectors so an encoding/library swap can't silently shift hashes.
    #[test]
    fn matches_known_vectors() {
        assert_eq!(
            sha256(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    /// Same input → same hash, every time (the property item-change detection relies on).
    #[test]
    fn is_stable_for_same_input() {
        assert_eq!(sha256("rule body"), sha256("rule body"));
        assert_ne!(sha256("rule body"), sha256("rule body changed"));
    }
}
