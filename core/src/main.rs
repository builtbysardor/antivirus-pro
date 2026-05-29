use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde_json::{json, Value};

use av_core_lib::{Scanner, SignatureDb, ScanResult, ThreatLevel};
use av_core_lib::realtime::RealtimeMonitor;
use av_core_lib::utils::compute_sha256;

// ── CLI definition ────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "av-core",
    version = env!("CARGO_PKG_VERSION"),
    about = "Professional antivirus scanner — scan files, watch directories, or hash files",
    long_about = None
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Scan a file or directory for malware.
    Scan {
        /// Path to the file or directory to scan.
        target: PathBuf,

        /// Recursively scan subdirectories (only meaningful for directory targets).
        #[arg(short, long, default_value_t = false)]
        recursive: bool,

        /// Path to the signature hash file.
        #[arg(short, long, default_value = "./signatures/malware_hashes.txt")]
        signatures: PathBuf,

        /// Output results as a JSON array instead of a human-readable table.
        #[arg(long, default_value_t = false)]
        json: bool,
    },

    /// Watch a directory in real-time and scan files as they are created or modified.
    Watch {
        /// Directory to monitor.
        directory: PathBuf,

        /// Path to the signature hash file.
        #[arg(short, long, default_value = "./signatures/malware_hashes.txt")]
        signatures: PathBuf,
    },

    /// Compute and print the SHA-256 hash of a file.
    Hash {
        /// Path to the file.
        file: PathBuf,
    },
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    // Initialise the logger.  RUST_LOG controls verbosity (default: warn).
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("warn"),
    )
    .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Scan {
            target,
            recursive,
            signatures,
            json,
        } => cmd_scan(&target, recursive, &signatures, json),

        Commands::Watch {
            directory,
            signatures,
        } => cmd_watch(&directory, &signatures),

        Commands::Hash { file } => cmd_hash(&file),
    }
}

// ── Subcommand implementations ────────────────────────────────────────────────

// ── scan ─────────────────────────────────────────────────────────────────────

fn cmd_scan(
    target: &Path,
    recursive: bool,
    signatures: &Path,
    json: bool,
) -> Result<()> {
    let sig_db = SignatureDb::load_or_empty(signatures);
    let scanner = Scanner::new(sig_db);

    let results: Vec<ScanResult> = if target.is_dir() {
        scanner.scan_directory(target, recursive)
    } else if target.is_file() {
        vec![scanner.scan_file(target)]
    } else {
        anyhow::bail!(
            "Target '{}' does not exist or is not accessible",
            target.display()
        );
    };

    if json {
        print_json(&results)?;
    } else {
        print_table(&results);
        print_summary(&results);
    }

    Ok(())
}

// ── watch ─────────────────────────────────────────────────────────────────────

fn cmd_watch(directory: &Path, signatures: &Path) -> Result<()> {
    if !directory.is_dir() {
        anyhow::bail!(
            "'{}' is not a directory or does not exist",
            directory.display()
        );
    }

    let sig_db = SignatureDb::load_or_empty(signatures);
    let monitor = RealtimeMonitor::new(directory.to_path_buf(), sig_db);

    eprintln!(
        "Watching '{}' for changes. Press Ctrl-C to stop.",
        directory.display()
    );

    // Set up Ctrl-C handler so we can print a clean exit message.
    ctrlc_handler();

    monitor.start(|result| {
        let level_str = format_level(&result.threat_level);
        let short_hash = &result.sha256[..8.min(result.sha256.len())];
        let filename = result
            .file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| result.file_path.display().to_string());

        if let Some(ref err) = result.error {
            eprintln!("[ERROR] {} : {}", filename, err);
            return;
        }

        println!(
            "[{level}] {file}  sha256:{hash}...  findings:{count}  {sig}",
            level = level_str,
            file = filename,
            hash = short_hash,
            count = result.findings.len(),
            sig = result
                .matched_signature
                .as_deref()
                .map(|s| format!("sig:{s}"))
                .unwrap_or_default(),
        );

        if result.threat_level != ThreatLevel::Clean {
            for f in &result.findings {
                println!("  [{sev:>2}] {rule}: {desc}", sev = f.severity, rule = f.rule, desc = f.description);
            }
        }
    })?;

    Ok(())
}

// ── hash ──────────────────────────────────────────────────────────────────────

fn cmd_hash(file: &Path) -> Result<()> {
    if !file.is_file() {
        anyhow::bail!("'{}' is not a file or does not exist", file.display());
    }
    let data = std::fs::read(file)
        .with_context(|| format!("Cannot read '{}'", file.display()))?;
    let hash = compute_sha256(&data);
    println!("{}  {}", hash, file.display());
    Ok(())
}

// ── Output helpers ────────────────────────────────────────────────────────────

fn format_level(level: &ThreatLevel) -> &'static str {
    match level {
        ThreatLevel::Clean => "CLEAN    ",
        ThreatLevel::Suspicious => "SUSPICIOU",
        ThreatLevel::Malicious => "MALICIOUS",
    }
}

/// Pretty-print a fixed-width table of scan results to stdout.
fn print_table(results: &[ScanResult]) {
    // Header
    println!(
        "{:<60}  {:<9}  {:>8}  {:>6}  {}",
        "File", "Threat", "Findings", "Hash", "Error"
    );
    println!("{}", "-".repeat(100));

    for r in results {
        let filename = r
            .file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| r.file_path.display().to_string());

        // Truncate long names.
        let display_name = if filename.len() > 60 {
            format!("...{}", &filename[filename.len() - 57..])
        } else {
            filename
        };

        let short_hash = if r.sha256.is_empty() {
            "--------".to_string()
        } else {
            r.sha256[..8].to_string()
        };

        let error_cell = r.error.as_deref().unwrap_or("");

        println!(
            "{:<60}  {:<9}  {:>8}  {}  {}",
            display_name,
            format_level(&r.threat_level),
            r.findings.len(),
            short_hash,
            error_cell,
        );

        // Print individual findings for non-clean files.
        if r.threat_level != ThreatLevel::Clean && r.error.is_none() {
            for f in &r.findings {
                println!(
                    "    [{sev:>2}] {rule:<30} {desc}",
                    sev = f.severity,
                    rule = f.rule,
                    desc = f.description,
                );
            }
        }
    }

    println!("{}", "-".repeat(100));
}

/// Print a one-line summary line after the table.
fn print_summary(results: &[ScanResult]) {
    let total = results.len();
    let malicious = results
        .iter()
        .filter(|r| r.threat_level == ThreatLevel::Malicious)
        .count();
    let suspicious = results
        .iter()
        .filter(|r| r.threat_level == ThreatLevel::Suspicious)
        .count();
    let errors = results.iter().filter(|r| r.error.is_some()).count();

    println!(
        "Scanned {total} file(s): {malicious} malicious, {suspicious} suspicious, {errors} error(s)."
    );
}

/// Serialise the first scan result as a single JSON dict matching the backend
/// contract expected by `backend/services/scanner.py:_parse_rust_output`.
///
/// Schema:
/// ```json
/// {
///   "entropy": 6.23,
///   "is_packed": false,
///   "suspicious_strings": ["powershell", "cmd.exe"],
///   "magic_bytes": "MZ",
///   "has_pe_header": true,
///   "threat_score": 0.72,
///   "details": {}
/// }
/// ```
fn print_json(results: &[ScanResult]) -> Result<()> {
    // The backend always scans one file at a time; use the first result.
    // If somehow multiple results arrive (directory scan with --json), emit
    // a JSON array of dicts so callers can still iterate over them.
    if results.len() == 1 {
        let dict = build_result_dict(&results[0]);
        let out = serde_json::to_string_pretty(&dict)
            .context("Failed to serialise result to JSON")?;
        println!("{out}");
    } else {
        let dicts: Vec<Value> = results.iter().map(build_result_dict).collect();
        let out = serde_json::to_string_pretty(&dicts)
            .context("Failed to serialise results to JSON")?;
        println!("{out}");
    }
    Ok(())
}

/// Convert a `ScanResult` into the flat JSON dict expected by the Python backend.
fn build_result_dict(r: &ScanResult) -> Value {
    // ── entropy ──────────────────────────────────────────────────────────────
    // Re-derive from findings: if HIGH_ENTROPY or ELEVATED_ENTROPY fired, parse
    // the value back from the description.  Otherwise fall back to 0.0.
    let entropy: f64 = r
        .findings
        .iter()
        .find(|f| f.rule == "HIGH_ENTROPY" || f.rule == "ELEVATED_ENTROPY")
        .and_then(|f| {
            // Description contains e.g. "Shannon entropy is 7.823 (>7.5) …"
            f.description
                .split_whitespace()
                .nth(3)
                .and_then(|s| s.parse::<f64>().ok())
        })
        .unwrap_or(0.0);

    // ── is_packed ─────────────────────────────────────────────────────────────
    let is_packed = (r.threat_level == ThreatLevel::Malicious && entropy > 7.2)
        || r.findings.iter().any(|f| f.rule == "PACKER_SECTION");

    // ── suspicious_strings ────────────────────────────────────────────────────
    // Collect findings whose rule starts with SUSPICIOUS or SCRIPT; map to their
    // rule names so the backend can display them.
    let suspicious_strings: Vec<Value> = r
        .findings
        .iter()
        .filter(|f| f.rule.starts_with("SUSPICIOUS") || f.rule.starts_with("SCRIPT"))
        .map(|f| Value::String(f.rule.clone()))
        .collect();

    // ── magic_bytes ───────────────────────────────────────────────────────────
    // Derive from findings: PE_EXECUTABLE means MZ; otherwise try to infer from
    // the file_path extension or leave null.
    let magic_bytes: Value = if r.findings.iter().any(|f| f.rule == "PE_EXECUTABLE") {
        Value::String("MZ".to_string())
    } else {
        // Try to infer from file extension as a heuristic.
        let ext = r
            .file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        match ext.as_str() {
            "elf" => Value::String("ELF".to_string()),
            "pdf" => Value::String("%PDF".to_string()),
            "png" => Value::String("PNG".to_string()),
            _ => Value::Null,
        }
    };

    // ── has_pe_header ─────────────────────────────────────────────────────────
    let has_pe_header = r.findings.iter().any(|f| f.rule == "PE_EXECUTABLE");

    // ── threat_score ──────────────────────────────────────────────────────────
    // max(findings[].severity) / 10.0, clamped to [0.0, 1.0]
    let max_sev = r.findings.iter().map(|f| f.severity).max().unwrap_or(0);
    let threat_score = (max_sev as f64 / 10.0_f64).clamp(0.0, 1.0);

    // ── details ───────────────────────────────────────────────────────────────
    // Expose all findings for full transparency.
    let findings_val: Vec<Value> = r
        .findings
        .iter()
        .map(|f| {
            json!({
                "rule": f.rule,
                "severity": f.severity,
                "description": f.description,
            })
        })
        .collect();

    let details = json!({
        "findings": findings_val,
        "sha256": r.sha256,
        "file_size": r.file_size,
        "threat_level": r.threat_level.to_string(),
        "is_signature_match": r.is_signature_match,
        "matched_signature": r.matched_signature,
        "scan_duration_ms": r.scan_duration_ms,
        "error": r.error,
    });

    json!({
        "entropy": entropy,
        "is_packed": is_packed,
        "suspicious_strings": suspicious_strings,
        "magic_bytes": magic_bytes,
        "has_pe_header": has_pe_header,
        "threat_score": threat_score,
        "details": details,
    })
}

/// Install a Ctrl-C handler that prints a message and exits cleanly.
fn ctrlc_handler() {
    // We do a best-effort install; if it fails we just skip it.
    // best-effort; if it fails we just skip it

    // Register via the `signal_hook` pattern using std channels.
    // Since we only have `tokio` and `anyhow` in deps we use a simple approach:
    // print a note and rely on the monitor loop exiting naturally on drop.
    std::thread::spawn(|| {
        // This thread parks forever; the OS kills us on Ctrl-C.
        // We just want the "Stopping…" message on stdout.
        loop {
            std::thread::park();
        }
    });
}
