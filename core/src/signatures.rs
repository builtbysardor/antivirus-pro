use std::{
    collections::HashMap,
    fs,
    path::Path,
};
use anyhow::{Context, Result};
use log::info;

/// In-memory signature database.
/// Each entry maps a lowercase SHA-256 hex string to a threat name / label.
#[derive(Debug, Clone, Default)]
pub struct SignatureDb {
    /// sha256_hex -> threat_name
    hashes: HashMap<String, String>,
}

impl SignatureDb {
    /// Create an empty database (useful for testing or when no file is present).
    pub fn empty() -> Self {
        SignatureDb {
            hashes: HashMap::new(),
        }
    }

    /// Load signatures from a file.
    ///
    /// Expected file format (one entry per line):
    /// ```text
    /// # comment lines start with '#'
    /// <sha256hex>  [optional threat name]
    /// <sha256hex>:<threat_name>
    /// ```
    /// If no threat name is provided the hash itself is used as the label.
    pub fn load_from_file(path: &Path) -> Result<SignatureDb> {
        let content = fs::read_to_string(path)
            .with_context(|| format!("Failed to read signature file: {}", path.display()))?;
        let mut db = SignatureDb::default();
        for (line_no, raw) in content.lines().enumerate() {
            let line = raw.trim();
            // Skip empty lines and comments
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            // Support two separators: colon  OR  whitespace
            let (hash, name) = if let Some(pos) = line.find(':') {
                let h = line[..pos].trim().to_lowercase();
                let n = line[pos + 1..].trim().to_string();
                let name_val = if n.is_empty() { h.clone() } else { n };
                (h, name_val)
            } else {
                let mut parts = line.splitn(2, |c: char| c.is_whitespace());
                let h = parts.next().unwrap_or("").trim().to_lowercase();
                let n = parts
                    .next()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format!("Malware.Hash.{}", &h[..8.min(h.len())]));
                (h, n)
            };

            if hash.len() != 64 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
                log::warn!(
                    "signatures.txt line {}: skipping invalid hash '{}'",
                    line_no + 1,
                    hash
                );
                continue;
            }
            db.hashes.insert(hash, name);
        }
        info!(
            "Loaded {} signature(s) from {}",
            db.hashes.len(),
            path.display()
        );
        Ok(db)
    }

    /// Try to load signatures; if the file is missing, return an empty DB
    /// instead of an error (the scanner can still perform heuristic analysis).
    pub fn load_or_empty(path: &Path) -> SignatureDb {
        if path.exists() {
            match SignatureDb::load_from_file(path) {
                Ok(db) => db,
                Err(e) => {
                    log::warn!("Could not load signatures: {e}. Running without signature DB.");
                    SignatureDb::empty()
                }
            }
        } else {
            log::info!(
                "Signature file not found at '{}'. Running without signature DB.",
                path.display()
            );
            SignatureDb::empty()
        }
    }

    /// Check whether a SHA-256 hash is in the database.
    /// Returns the associated threat name when found.
    pub fn is_malicious(&self, hash: &str) -> Option<&str> {
        self.hashes.get(&hash.to_lowercase()).map(String::as_str)
    }

    /// Number of signatures loaded.
    pub fn len(&self) -> usize {
        self.hashes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.hashes.is_empty()
    }

    /// Add a hash programmatically (useful for testing and dynamic updates).
    pub fn insert(&mut self, hash: impl Into<String>, name: impl Into<String>) {
        self.hashes.insert(hash.into().to_lowercase(), name.into());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_db() {
        let db = SignatureDb::empty();
        assert!(db.is_malicious("abc123").is_none());
    }

    #[test]
    fn test_insert_and_lookup() {
        let mut db = SignatureDb::empty();
        let hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        db.insert(hash, "Test.Malware.Empty");
        assert_eq!(db.is_malicious(hash), Some("Test.Malware.Empty"));
        // Case-insensitive lookup
        assert_eq!(db.is_malicious(&hash.to_uppercase()), Some("Test.Malware.Empty"));
    }

    #[test]
    fn test_parse_signatures() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut f = NamedTempFile::new().unwrap();
        writeln!(
            f,
            "# comment\n\
             e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 Trojan.EmptyFile\n\
             aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899:Worm.Test\n\
             bad_hash_should_be_skipped"
        )
        .unwrap();

        let db = SignatureDb::load_from_file(f.path()).unwrap();
        assert_eq!(db.len(), 2);
        assert_eq!(
            db.is_malicious("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
            Some("Trojan.EmptyFile")
        );
        assert_eq!(
            db.is_malicious("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"),
            Some("Worm.Test")
        );
    }
}
