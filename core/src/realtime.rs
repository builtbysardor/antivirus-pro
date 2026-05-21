use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use notify::{
    event::{CreateKind, ModifyKind},
    Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};

use crate::scanner::{ScanResult, Scanner};
use crate::signatures::SignatureDb;

// ── Debounce state ────────────────────────────────────────────────────────────

/// Tracks the last time a file path was seen in a filesystem event so we can
/// suppress duplicate notifications within the debounce window.
type DebounceMap = Arc<Mutex<HashMap<PathBuf, Instant>>>;

const DEBOUNCE_MS: u64 = 500;

fn should_process(map: &DebounceMap, path: &PathBuf) -> bool {
    let mut guard = map.lock().expect("debounce mutex poisoned");
    let now = Instant::now();
    match guard.get(path) {
        Some(&last) if now.duration_since(last) < Duration::from_millis(DEBOUNCE_MS) => false,
        _ => {
            guard.insert(path.clone(), now);
            true
        }
    }
}

// ── RealtimeMonitor ───────────────────────────────────────────────────────────

/// Watches a directory for newly created or modified files and scans each one
/// as it arrives, calling a user-supplied callback with the `ScanResult`.
pub struct RealtimeMonitor {
    path: PathBuf,
    scanner: Arc<Scanner>,
}

impl RealtimeMonitor {
    /// Create a monitor for `path`, using `sig_db` for signature lookups.
    pub fn new(path: PathBuf, sig_db: SignatureDb) -> Self {
        RealtimeMonitor {
            path,
            scanner: Arc::new(Scanner::new(sig_db)),
        }
    }

    /// Start watching the directory.
    ///
    /// This function **blocks** until an error occurs or the process is
    /// interrupted (Ctrl-C).  Each file event triggers `callback` with the
    /// `ScanResult` on the calling thread.
    ///
    /// # Event handling
    ///
    /// Only `Create` and `Modify` events for *files* (not directories) are
    /// processed.  A 500 ms debounce window prevents the same path from being
    /// scanned more than once per burst of rapid events (common with editors
    /// that save through a temp file).
    ///
    /// If a file disappears between the event and the actual read (race
    /// condition), the error is logged at WARN level and the callback is NOT
    /// invoked, so consumers never see a spurious result.
    pub fn start(
        &self,
        callback: impl Fn(ScanResult) + Send + 'static,
    ) -> Result<()> {
        let watch_path = self.path.clone();
        let scanner = Arc::clone(&self.scanner);
        let debounce: DebounceMap = Arc::new(Mutex::new(HashMap::new()));
        let callback = Arc::new(callback);

        // Channel through which the watcher sends raw filesystem events.
        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();

        let mut watcher = RecommendedWatcher::new(
            move |res| {
                // Forward the event; ignore send errors (receiver gone = shutting down).
                let _ = tx.send(res);
            },
            notify::Config::default()
                .with_poll_interval(Duration::from_millis(200)),
        )
        .context("Failed to create filesystem watcher")?;

        watcher
            .watch(&watch_path, RecursiveMode::Recursive)
            .with_context(|| format!("Cannot watch path: {}", watch_path.display()))?;

        log::info!("Real-time monitor started on: {}", watch_path.display());

        for raw_event in &rx {
            match raw_event {
                Err(e) => {
                    log::warn!("Watcher error: {e}");
                    continue;
                }
                Ok(event) => {
                    // Only care about create / modify events.
                    let relevant = matches!(
                        event.kind,
                        EventKind::Create(CreateKind::File)
                            | EventKind::Create(CreateKind::Any)
                            | EventKind::Modify(ModifyKind::Data(_))
                            | EventKind::Modify(ModifyKind::Any)
                    );
                    if !relevant {
                        continue;
                    }

                    for path in event.paths {
                        // Skip directories.
                        if path.is_dir() {
                            continue;
                        }

                        // Debounce: skip if we scanned this path very recently.
                        if !should_process(&debounce, &path) {
                            log::debug!("Debounced: {}", path.display());
                            continue;
                        }

                        // The file may have been deleted between the event and
                        // now — check before handing off to the scanner.
                        if !path.exists() {
                            log::warn!(
                                "File disappeared before scan: {}",
                                path.display()
                            );
                            continue;
                        }

                        log::info!("Scanning new/modified file: {}", path.display());

                        let result = scanner.scan_file(&path);

                        // Skip results produced from error (file gone mid-scan).
                        if result.error.is_some() {
                            log::warn!(
                                "Scan error for {}: {}",
                                path.display(),
                                result.error.as_deref().unwrap_or("")
                            );
                            continue;
                        }

                        callback(result);
                    }
                }
            }
        }

        // The loop exits only if `rx` is hung up, meaning the watcher was
        // dropped.  This should not happen during normal operation.
        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;
    use tempfile::TempDir;

    #[test]
    fn test_debounce_suppresses_rapid_repeat() {
        let map: DebounceMap = Arc::new(Mutex::new(HashMap::new()));
        let path = PathBuf::from("/tmp/test_file.txt");

        // First call should go through.
        assert!(should_process(&map, &path), "First call must pass debounce");
        // Immediate second call for the same path must be suppressed.
        assert!(
            !should_process(&map, &path),
            "Second immediate call must be debounced"
        );
    }

    #[test]
    fn test_realtime_monitor_detects_new_file() {
        let dir = TempDir::new().unwrap();
        let dir_path = dir.path().to_path_buf();
        let db = SignatureDb::empty();

        let monitor = Arc::new(RealtimeMonitor::new(dir_path.clone(), db));
        let count = Arc::new(AtomicUsize::new(0));
        let count_clone = Arc::clone(&count);

        // Run the monitor in a background thread.
        let monitor_clone = Arc::clone(&monitor);
        let _handle = std::thread::spawn(move || {
            monitor_clone
                .start(move |_result| {
                    count_clone.fetch_add(1, Ordering::SeqCst);
                })
                .unwrap_or(());
        });

        // Give the watcher a moment to initialize.
        std::thread::sleep(Duration::from_millis(300));

        // Write a file into the watched directory.
        let test_file = dir_path.join("canary.txt");
        std::fs::write(&test_file, b"test content for realtime scan").unwrap();

        // Wait long enough for the event to be processed.
        std::thread::sleep(Duration::from_millis(1500));

        assert!(
            count.load(Ordering::SeqCst) >= 1,
            "Expected at least one scan result from the monitor"
        );
    }
}
