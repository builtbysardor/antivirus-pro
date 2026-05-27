use std::path::Path;

use goblin::pe::PE;

use crate::scanner::HeuristicFinding;
use crate::utils::compute_entropy;

// ── Suspicious import names that appear in malware ────────────────────────────
static SUSPICIOUS_IMPORTS: &[&str] = &[
    "VirtualAlloc",
    "VirtualAllocEx",
    "VirtualProtect",
    "WriteProcessMemory",
    "ReadProcessMemory",
    "CreateRemoteThread",
    "OpenProcess",
    "NtUnmapViewOfSection",
    "SetWindowsHookEx",
    "GetAsyncKeyState",
    "keybd_event",
    "mouse_event",
    "RegOpenKeyEx",
    "RegCreateKeyEx",
    "RegSetValueEx",
    "ShellExecute",
    "URLDownloadToFile",
    "WinExec",
    "CreateService",
    "StartService",
    "IsDebuggerPresent",
    "CheckRemoteDebuggerPresent",
    "NtQueryInformationProcess",
    "SetUnhandledExceptionFilter",
];

// ── Generic suspicious strings (applies to all file types) ───────────────────
static SUSPICIOUS_STRINGS: &[&str] = &[
    "cmd.exe",
    "powershell",
    "wget",
    "curl",
    "base64",
    "eval(",
    "exec(",
    "CreateProcess",
    "RegCreateKey",
    "HKLM",
    "HKCU",
    "netsh",
    "taskkill",
    "net user",
    "net localgroup",
    "sc create",
    "schtasks",
    "attrib +h",
    "attrib +s",
    "/etc/passwd",
    "/etc/shadow",
    "chmod 777",
    "chmod +x",
    "nc -e",
    "bash -i",
    "python -c",
    "/dev/tcp",
    "meterpreter",
    "mimikatz",
    "sekurlsa",
    "lsass.exe",
    "pass-the-hash",
    "invoke-mimikatz",
    "invoke-shellcode",
    "shellcode",
    "exploit",
    "payload",
    "reverse_tcp",
    "bind_tcp",
];

// ── Script-specific obfuscation patterns ─────────────────────────────────────
// These apply to .js / .vbs / .ps1 / .bat files.
static SCRIPT_SUSPICIOUS: &[&str] = &[
    "eval(unescape",
    "eval(atob",
    "eval(String.fromCharCode",
    "WScript.Shell",
    "ActiveXObject",
    "ADODB.Stream",
    "Scripting.FileSystemObject",
    "Shell.Application",
    "document.write(unescape",
    "document.write(String.fromCharCode",
    "window[",       // bracket-notation obfuscation
    "this[",
    "[\"exec\"]",
    "fromCharCode",
    "\\x65\\x76\\x61\\x6c", // hex-encoded "eval"
    "\\u0065\\u0076\\u0061\\u006c", // unicode-encoded "eval"
    "-EncodedCommand",
    "-enc ",
    "IEX(",
    "Invoke-Expression",
    "Invoke-WebRequest",
    "Net.WebClient",
    "DownloadString",
    "DownloadFile",
    "System.Reflection.Assembly",
    "[System.Convert]::FromBase64String",
    "Convert.FromBase64String",
];

/// A long base64 run (≥ 100 contiguous base64 characters) is a strong obfuscation signal.
const LONG_BASE64_THRESHOLD: usize = 100;

/// File extensions we treat as scripts.
static SCRIPT_EXTENSIONS: &[&str] = &["js", "vbs", "vbe", "ps1", "bat", "cmd", "hta", "wsf"];

// ─────────────────────────────────────────────────────────────────────────────

/// Run all heuristic checks against a file.
///
/// `path`  – used for extension-based checks and logging.
/// `data`  – raw file bytes (may be empty for zero-byte files).
///
/// Returns a list of `HeuristicFinding`s ordered by descending severity.
pub fn analyze_file(path: &Path, data: &[u8]) -> Vec<HeuristicFinding> {
    let mut findings: Vec<HeuristicFinding> = Vec::new();

    if data.is_empty() {
        return findings;
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // 1. Entropy check ─────────────────────────────────────────────────────
    let entropy = compute_entropy(data);
    if entropy > 7.5 {
        findings.push(HeuristicFinding {
            rule: "HIGH_ENTROPY".to_string(),
            severity: 8,
            description: format!(
                "Shannon entropy is {:.3} (>7.5) — file is likely packed, encrypted, or obfuscated",
                entropy
            ),
        });
    } else if entropy > 7.2 {
        findings.push(HeuristicFinding {
            rule: "ELEVATED_ENTROPY".to_string(),
            severity: 5,
            description: format!(
                "Shannon entropy is {:.3} (>7.2) — possible packing or compression",
                entropy
            ),
        });
    }

    // 2. PE header analysis ────────────────────────────────────────────────
    if data.len() >= 2 && &data[0..2] == b"MZ" {
        findings.extend(analyze_pe(data));
    }

    // 3. Suspicious strings (all file types) ──────────────────────────────
    findings.extend(scan_suspicious_strings(data));

    // 4. Script analysis ───────────────────────────────────────────────────
    if SCRIPT_EXTENSIONS.contains(&ext.as_str()) {
        findings.extend(analyze_script(data));
    }

    // 5. Polyglot / extension–magic-bytes mismatch ────────────────────────
    if let Some(f) = check_polyglot(path, data, &ext) {
        findings.push(f);
    }

    // Sort by descending severity for easy consumption.
    findings.sort_by(|a, b| b.severity.cmp(&a.severity));
    findings
}

// ─────────────────────────────────────────────────────────────────────────────
// PE analysis (goblin-based)
// ─────────────────────────────────────────────────────────────────────────────

/// Known packer section name prefixes / exact names (lowercase).
static PACKER_SECTIONS: &[&str] = &[
    "upx0", "upx1", "upx2",
    ".themida",
    ".vmp0", ".vmp1",
    "protect",
    "pec2",
    ".aspack",
    ".adata",
    "nsp0", "nsp1", "nsp2",
];

fn analyze_pe(data: &[u8]) -> Vec<HeuristicFinding> {
    let mut findings = Vec::new();

    // Quick sanity check: verify the PE signature at the offset stored in the
    // DOS header so we can emit PE_EXECUTABLE even if goblin rejects the file.
    let has_pe_sig = data.len() >= 64 && {
        let pe_off = u32::from_le_bytes([data[60], data[61], data[62], data[63]]) as usize;
        pe_off + 4 <= data.len() && &data[pe_off..pe_off + 4] == b"PE\x00\x00"
    };

    if has_pe_sig {
        findings.push(HeuristicFinding {
            rule: "PE_EXECUTABLE".to_string(),
            severity: 1,
            description: "File is a Windows PE executable".to_string(),
        });
    }

    // Use goblin for deep parsing.  If it fails we still have the findings
    // collected above; the suspicious-string scan higher up will also catch
    // import names that appear as ASCII in the binary.
    let pe = match PE::parse(data) {
        Ok(p) => p,
        Err(_) => return findings,
    };

    // ── Section names — packer detection ─────────────────────────────────────
    for section in &pe.sections {
        let raw_name = section.name().unwrap_or("");
        let name_lower = raw_name.to_lowercase();
        if PACKER_SECTIONS.iter().any(|&p| name_lower.starts_with(p) || name_lower == p) {
            findings.push(HeuristicFinding {
                rule: "PACKER_SECTION".to_string(),
                severity: 7,
                description: format!(
                    "PE section '{}' matches known packer (UPX / VMProtect / Themida / ASPack)",
                    raw_name
                ),
            });
        }
    }

    // ── Imports — real import table via goblin ────────────────────────────────
    let mut import_hits: Vec<String> = Vec::new();
    for import in &pe.imports {
        let name = import.name.to_string();
        if SUSPICIOUS_IMPORTS.iter().any(|&s| s.eq_ignore_ascii_case(&name)) {
            import_hits.push(name);
        }
    }
    if !import_hits.is_empty() {
        let count = import_hits.len();
        let severity = match count {
            1..=2 => 3u8,
            3..=5 => 6,
            _ => 8,
        };
        findings.push(HeuristicFinding {
            rule: "SUSPICIOUS_IMPORTS".to_string(),
            severity,
            description: format!(
                "Found {} suspicious API import(s): {}",
                count,
                import_hits.join(", ")
            ),
        });
    }

    // ── Optional header security characteristics ──────────────────────────────
    // IMAGE_DLLCHARACTERISTICS_DYNAMIC_BASE (ASLR) = 0x0040
    // IMAGE_DLLCHARACTERISTICS_NX_COMPAT (DEP)     = 0x0100
    if let Some(opt) = pe.header.optional_header {
        let chars = opt.windows_fields.dll_characteristics;
        let no_aslr = (chars & 0x0040) == 0;
        let no_dep  = (chars & 0x0100) == 0;
        if no_aslr || no_dep {
            findings.push(HeuristicFinding {
                rule: "PE_NO_MITIGATIONS".to_string(),
                severity: 4,
                description: format!(
                    "PE lacks security mitigations: ASLR={} DEP={}",
                    if no_aslr { "disabled" } else { "enabled" },
                    if no_dep  { "disabled" } else { "enabled" },
                ),
            });
        }
    }

    findings
}

// ─────────────────────────────────────────────────────────────────────────────
// Suspicious string scan (all file types)
// ─────────────────────────────────────────────────────────────────────────────

fn scan_suspicious_strings(data: &[u8]) -> Vec<HeuristicFinding> {
    let mut findings = Vec::new();
    // Work on a lossy UTF-8 view to avoid allocating per-byte.
    let text = String::from_utf8_lossy(data);
    let text_lower = text.to_lowercase();

    let mut hits: Vec<String> = Vec::new();
    for &s in SUSPICIOUS_STRINGS {
        if text_lower.contains(&s.to_lowercase()) {
            hits.push(s.to_string());
        }
    }

    if !hits.is_empty() {
        let count = hits.len();
        let severity = match count {
            1 => 2u8,
            2..=4 => 4,
            5..=9 => 6,
            _ => 8,
        };
        findings.push(HeuristicFinding {
            rule: "SUSPICIOUS_STRINGS".to_string(),
            severity,
            description: format!(
                "Found {} suspicious string(s): {}",
                count,
                hits.join(", ")
            ),
        });
    }

    findings
}

// ─────────────────────────────────────────────────────────────────────────────
// Script analysis
// ─────────────────────────────────────────────────────────────────────────────

fn analyze_script(data: &[u8]) -> Vec<HeuristicFinding> {
    let mut findings = Vec::new();
    let text = match std::str::from_utf8(data) {
        Ok(t) => t.to_string(),
        Err(_) => String::from_utf8_lossy(data).to_string(),
    };

    // Check for script-specific obfuscation keywords
    let text_lower = text.to_lowercase();
    let mut script_hits: Vec<String> = Vec::new();
    for &s in SCRIPT_SUSPICIOUS {
        if text_lower.contains(&s.to_lowercase()) {
            script_hits.push(s.to_string());
        }
    }
    if !script_hits.is_empty() {
        let count = script_hits.len();
        let severity = match count {
            1..=2 => 5u8,
            3..=5 => 7,
            _ => 9,
        };
        findings.push(HeuristicFinding {
            rule: "SCRIPT_OBFUSCATION".to_string(),
            severity,
            description: format!(
                "Script contains {} obfuscation/suspicious pattern(s): {}",
                count,
                script_hits.join(", ")
            ),
        });
    }

    // Detect long base64 blobs (≥ LONG_BASE64_THRESHOLD contiguous base64 chars)
    if has_long_base64(&text) {
        findings.push(HeuristicFinding {
            rule: "LONG_BASE64_STRING".to_string(),
            severity: 6,
            description: format!(
                "Script contains a base64 string of ≥{} characters — possible encoded payload",
                LONG_BASE64_THRESHOLD
            ),
        });
    }

    findings
}

/// Returns `true` if `text` contains a run of ≥ `LONG_BASE64_THRESHOLD`
/// consecutive base64-alphabet characters.
fn has_long_base64(text: &str) -> bool {
    let mut run = 0usize;
    for ch in text.chars() {
        if ch.is_ascii_alphanumeric() || ch == '+' || ch == '/' || ch == '=' {
            run += 1;
            if run >= LONG_BASE64_THRESHOLD {
                return true;
            }
        } else {
            run = 0;
        }
    }
    false
}

// ─────────────────────────────────────────────────────────────────────────────
// Polyglot detection
// ─────────────────────────────────────────────────────────────────────────────

/// Map common extensions to the first magic bytes we expect.
fn expected_magic(ext: &str) -> Option<&'static [u8]> {
    match ext {
        "pdf" => Some(b"%PDF"),
        "png" => Some(b"\x89PNG"),
        "jpg" | "jpeg" => Some(b"\xff\xd8\xff"),
        "gif" => Some(b"GIF8"),
        "zip" | "docx" | "xlsx" | "pptx" | "jar" | "apk" => Some(b"PK\x03\x04"),
        "elf" => Some(b"\x7fELF"),
        "exe" | "dll" | "sys" | "drv" | "scr" => Some(b"MZ"),
        "class" => Some(b"\xca\xfe\xba\xbe"),
        _ => None,
    }
}

fn check_polyglot(path: &Path, data: &[u8], ext: &str) -> Option<HeuristicFinding> {
    let magic = expected_magic(ext)?;
    if data.len() < magic.len() {
        return None;
    }
    if data.starts_with(magic) {
        return None; // OK
    }
    Some(HeuristicFinding {
        rule: "POLYGLOT_MISMATCH".to_string(),
        severity: 7,
        description: format!(
            "File extension '.{}' does not match its magic bytes — possible polyglot / disguised executable (file: {})",
            ext,
            path.display()
        ),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fake_path(name: &str) -> PathBuf {
        PathBuf::from(format!("/tmp/{}", name))
    }

    #[test]
    fn test_high_entropy_random_data() {
        // Approximate high-entropy data: cycle through all byte values.
        let data: Vec<u8> = (0u8..=255).cycle().take(4096).collect();
        let findings = analyze_file(&fake_path("test.bin"), &data);
        let rules: Vec<&str> = findings.iter().map(|f| f.rule.as_str()).collect();
        assert!(
            rules.contains(&"HIGH_ENTROPY") || rules.contains(&"ELEVATED_ENTROPY"),
            "Expected entropy finding, got: {:?}",
            rules
        );
    }

    #[test]
    fn test_suspicious_string_detection() {
        let data = b"This file calls powershell and cmd.exe and uses base64 encoding via eval(";
        let findings = scan_suspicious_strings(data);
        assert!(
            !findings.is_empty(),
            "Expected suspicious string findings"
        );
    }

    #[test]
    fn test_script_long_base64() {
        let long_b64 = "A".repeat(200);
        let data = format!("var x = '{}';", long_b64);
        assert!(has_long_base64(&data));
    }

    #[test]
    fn test_polyglot_pdf_with_mz() {
        // A file with .pdf extension but MZ magic bytes
        let mut data = vec![0u8; 64];
        data[0] = b'M';
        data[1] = b'Z';
        let path = fake_path("malware.pdf");
        let result = check_polyglot(&path, &data, "pdf");
        assert!(result.is_some(), "Expected polyglot finding");
    }

    #[test]
    fn test_no_findings_clean_text() {
        let data = b"Hello, world! This is a totally innocent text file.";
        let findings = analyze_file(&fake_path("readme.txt"), data);
        // May have no findings or only very low severity ones.
        let max_sev = findings.iter().map(|f| f.severity).max().unwrap_or(0);
        assert!(max_sev < 5, "Expected low severity for clean text, got {}", max_sev);
    }
}
