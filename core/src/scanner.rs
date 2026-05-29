use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::heuristic::analyze_file;
use crate::signatures::SignatureDb;
use crate::utils::{compute_entropy, compute_sha256};

// ── HeuristicFinding ─────────────────────────────────────────────────────────

/// A single finding produced by the heuristic engine.
/// Defined here so both `scanner` and `heuristic` share the same type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeuristicFinding {
    /// Short rule identifier (e.g. "HIGH_ENTROPY", "SUSPICIOUS_IMPORTS").
    pub rule: String,
    /// Severity score 0-10.
    pub severity: u8,
    /// Human-readable explanation of why the rule fired.
    pub description: String,
}

// ── ThreatLevel ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ThreatLevel {
    /// No indicators of compromise detected.
    Clean,
    /// Low-to-medium severity heuristic signals; warrants further review.
    Suspicious,
    /// Signature match OR high-severity heuristic evidence of malware.
    Malicious,
}

impl std::fmt::Display for ThreatLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ThreatLevel::Clean => write!(f, "CLEAN"),
            ThreatLevel::Suspicious => write!(f, "SUSPICIOUS"),
            ThreatLevel::Malicious => write!(f, "MALICIOUS"),
        }
    }
}

impl ThreatLevel {
    /// Derive a threat level from the maximum heuristic severity and whether
    /// a signature matched.
    pub fn from_severity(max_severity: u8, signature_match: bool) -> Self {
        if signature_match || max_severity >= 7 {
            ThreatLevel::Malicious
        } else if max_severity >= 4 {
            ThreatLevel::Suspicious
        } else {
            ThreatLevel::Clean
        }
    }
}

// ── ScanResult ────────────────────────────────────────────────────────────────

/// The complete output for a single scanned file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    /// Absolute path to the file.
    pub file_path: PathBuf,
    /// SHA-256 hex digest of the file contents.
    pub sha256: String,
    /// Size in bytes.
    pub file_size: u64,
    /// Shannon entropy of the file contents [0.0, 8.0].
    pub entropy: f64,
    /// Overall threat classification.
    pub threat_level: ThreatLevel,
    /// Heuristic findings (sorted by descending severity).
    pub findings: Vec<HeuristicFinding>,
    /// True when the file's hash was found in the signature database.
    pub is_signature_match: bool,
    /// The name of the matched signature (if any).
    pub matched_signature: Option<String>,
    /// Wall-clock time spent scanning this file, in milliseconds.
    pub scan_duration_ms: u64,
    /// Non-fatal error encountered while scanning (e.g. permission denied).
    pub error: Option<String>,
}

impl ScanResult {
    /// Build a result that represents a file that could not be scanned.
    fn error_result(path: PathBuf, err: String, duration_ms: u64) -> Self {
        ScanResult {
            file_path: path,
            sha256: String::new(),
            file_size: 0,
            entropy: 0.0,
            threat_level: ThreatLevel::Clean,
            findings: Vec::new(),
            is_signature_match: false,
            matched_signature: None,
            scan_duration_ms: duration_ms,
            error: Some(err),
        }
    }
}

// ── Scanner ───────────────────────────────────────────────────────────────────

/// The main scanner.  Cheap to clone (the `SignatureDb` uses an `Arc` internally
/// via derive Clone on HashMap).
#[derive(Debug, Clone)]
pub struct Scanner {
    sig_db: SignatureDb,
}

impl Scanner {
    /// Create a new scanner backed by the given signature database.
    pub fn new(sig_db: SignatureDb) -> Self {
        Scanner { sig_db }
    }

    // ── Single-file scan ──────────────────────────────────────────────────

    /// Scan a single file and return a `ScanResult`.
    ///
    /// Steps:
    /// 1. Read the file bytes.
    /// 2. Compute SHA-256.
    /// 3. Check the signature database — if matched, mark Malicious immediately.
    /// 4. Run heuristic analysis regardless of signature result (we still want
    ///    the full picture even for known-bad files).
    /// 5. Derive the final `ThreatLevel`.
    pub fn scan_file(&self, path: &Path) -> ScanResult {
        let t0 = Instant::now();

        // ── Read file ─────────────────────────────────────────────────────
        let metadata = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(e) => {
                let ms = t0.elapsed().as_millis() as u64;
                return ScanResult::error_result(
                    path.to_path_buf(),
                    format!("Cannot read metadata: {e}"),
                    ms,
                );
            }
        };

        // Skip directories silently (callers sometimes pass them by mistake).
        if metadata.is_dir() {
            let ms = t0.elapsed().as_millis() as u64;
            return ScanResult::error_result(
                path.to_path_buf(),
                "Path is a directory".to_string(),
                ms,
            );
        }

        let file_size = metadata.len();

        // Cap reads at 100 MB to prevent OOM on huge files.
        // The (possibly truncated) buffer is fine for heuristic analysis and
        // SHA-256 — a hash of the truncated content is still a stable
        // fingerprint for the bytes we actually examined.
        use std::io::Read as _;
        const MAX_FILE_BYTES: u64 = 100 * 1024 * 1024; // 100 MB
        let data = match std::fs::File::open(path) {
            Ok(f) => {
                let mut buf = Vec::new();
                match f.take(MAX_FILE_BYTES).read_to_end(&mut buf) {
                    Ok(_) => buf,
                    Err(e) => {
                        let ms = t0.elapsed().as_millis() as u64;
                        return ScanResult::error_result(
                            path.to_path_buf(),
                            format!("Cannot read file: {e}"),
                            ms,
                        );
                    }
                }
            }
            Err(e) => {
                let ms = t0.elapsed().as_millis() as u64;
                return ScanResult::error_result(
                    path.to_path_buf(),
                    format!("Cannot open file: {e}"),
                    ms,
                );
            }
        };

        // ── SHA-256 ───────────────────────────────────────────────────────
        let sha256 = compute_sha256(&data);

        // ── Signature lookup ──────────────────────────────────────────────
        let (is_signature_match, matched_signature) =
            if let Some(name) = self.sig_db.is_malicious(&sha256) {
                log::info!(
                    "Signature match: {} -> {}",
                    path.display(),
                    name
                );
                (true, Some(name.to_string()))
            } else {
                (false, None)
            };

        // ── Heuristic analysis ────────────────────────────────────────────
        let findings: Vec<HeuristicFinding> = analyze_file(path, &data);

        // ── Threat level ──────────────────────────────────────────────────
        let max_severity = findings.iter().map(|f| f.severity).max().unwrap_or(0);
        let threat_level = ThreatLevel::from_severity(max_severity, is_signature_match);

        let scan_duration_ms = t0.elapsed().as_millis() as u64;

        ScanResult {
            file_path: path.to_path_buf(),
            sha256,
            file_size,
            entropy: compute_entropy(&data),
            threat_level,
            findings,
            is_signature_match,
            matched_signature,
            scan_duration_ms,
            error: None,
        }
    }

    // ── Directory scan ────────────────────────────────────────────────────

    /// Scan all files inside `dir`.
    ///
    /// * `recursive` — if `true`, walk subdirectories; otherwise only the
    ///   immediate children of `dir` are scanned.
    ///
    /// Files are scanned in parallel using Rayon.  Directories and symlinks
    /// that cannot be followed are silently skipped.
    pub fn scan_directory(&self, dir: &Path, recursive: bool) -> Vec<ScanResult> {
        let max_depth = if recursive { usize::MAX } else { 1 };

        // Collect all file paths first so Rayon can work on a slice.
        let paths: Vec<PathBuf> = WalkDir::new(dir)
            .max_depth(max_depth)
            .follow_links(false)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter(|e| e.file_type().is_file())
            .map(|e| e.into_path())
            .collect();

        log::info!(
            "Scanning {} file(s) in '{}' (recursive={})",
            paths.len(),
            dir.display(),
            recursive
        );

        // Parallel scan — `self` is Sync because SignatureDb is Sync.
        paths
            .par_iter()
            .map(|p| self.scan_file(p))
            .collect()
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns `true` when the result should be reported to the user
/// (i.e. it is not a clean file with no errors).
pub fn is_notable(result: &ScanResult) -> bool {
    result.threat_level != ThreatLevel::Clean || result.error.is_some()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::{NamedTempFile, TempDir};

    fn scanner_no_sigs() -> Scanner {
        Scanner::new(SignatureDb::empty())
    }

    #[test]
    fn test_scan_clean_text_file() {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(b"Hello, world! Totally innocent text.").unwrap();
        let result = scanner_no_sigs().scan_file(f.path());
        assert!(result.error.is_none());
        assert!(!result.sha256.is_empty());
        assert_eq!(result.file_size, 36);
        assert_eq!(result.threat_level, ThreatLevel::Clean);
        assert!(!result.is_signature_match);
    }

    #[test]
    fn test_scan_signature_match() {
        // SHA-256 of empty file
        let empty_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let mut db = SignatureDb::empty();
        db.insert(empty_hash, "Test.Malware.Empty");
        let scanner = Scanner::new(db);

        let f = NamedTempFile::new().unwrap(); // zero-byte temp file
        let result = scanner.scan_file(f.path());

        assert!(result.is_signature_match);
        assert_eq!(result.matched_signature.as_deref(), Some("Test.Malware.Empty"));
        assert_eq!(result.threat_level, ThreatLevel::Malicious);
    }

    #[test]
    fn test_scan_missing_file() {
        let result = scanner_no_sigs().scan_file(Path::new("/nonexistent/path/file.bin"));
        assert!(result.error.is_some());
    }

    #[test]
    fn test_scan_directory_non_recursive() {
        let dir = TempDir::new().unwrap();
        // Create two files in the root and one in a subdirectory.
        std::fs::write(dir.path().join("a.txt"), b"file a").unwrap();
        std::fs::write(dir.path().join("b.txt"), b"file b").unwrap();
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub/c.txt"), b"file c").unwrap();

        let results = scanner_no_sigs().scan_directory(dir.path(), false);
        assert_eq!(results.len(), 2, "Non-recursive should skip sub/c.txt");
    }

    #[test]
    fn test_scan_directory_recursive() {
        let dir = TempDir::new().unwrap();
        std::fs::write(dir.path().join("a.txt"), b"file a").unwrap();
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub/b.txt"), b"file b").unwrap();

        let results = scanner_no_sigs().scan_directory(dir.path(), true);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_threat_level_from_severity() {
        assert_eq!(ThreatLevel::from_severity(0, false), ThreatLevel::Clean);
        assert_eq!(ThreatLevel::from_severity(3, false), ThreatLevel::Clean);
        assert_eq!(ThreatLevel::from_severity(4, false), ThreatLevel::Suspicious);
        assert_eq!(ThreatLevel::from_severity(6, false), ThreatLevel::Suspicious);
        assert_eq!(ThreatLevel::from_severity(7, false), ThreatLevel::Malicious);
        assert_eq!(ThreatLevel::from_severity(10, false), ThreatLevel::Malicious);
        assert_eq!(ThreatLevel::from_severity(0, true), ThreatLevel::Malicious);
    }
}
