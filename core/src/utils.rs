use sha2::{Digest, Sha256};

/// Compute the SHA-256 hash of raw bytes and return it as a lowercase hex string.
pub fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Compute Shannon entropy of a byte slice.
/// Returns a value in [0.0, 8.0]; values above ~7.2 suggest packing or encryption.
pub fn compute_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    let mut freq = [0u64; 256];
    for &b in data {
        freq[b as usize] += 1;
    }
    let len = data.len() as f64;
    freq.iter()
        .filter(|&&c| c > 0)
        .map(|&c| {
            let p = c as f64 / len;
            -p * p.log2()
        })
        .sum()
}

/// Detect file type from magic bytes (first up to 16 bytes).
/// Returns a human-readable type string.
pub fn detect_file_type(data: &[u8]) -> String {
    if data.len() < 2 {
        return "Unknown".to_string();
    }

    // Windows PE / DOS executable
    if data.starts_with(b"MZ") {
        // Look for PE signature at offset given in DOS header
        if data.len() >= 64 {
            let pe_offset = u32::from_le_bytes([
                data.get(60).copied().unwrap_or(0),
                data.get(61).copied().unwrap_or(0),
                data.get(62).copied().unwrap_or(0),
                data.get(63).copied().unwrap_or(0),
            ]) as usize;
            if pe_offset + 4 <= data.len()
                && &data[pe_offset..pe_offset + 4] == b"PE\x00\x00"
            {
                return "PE Executable".to_string();
            }
        }
        return "DOS/MZ Executable".to_string();
    }

    // ELF binary
    if data.starts_with(b"\x7fELF") {
        return "ELF Binary".to_string();
    }

    // PDF
    if data.starts_with(b"%PDF") {
        return "PDF Document".to_string();
    }

    // ZIP / DOCX / XLSX / PPTX / JAR (all ZIP-based)
    if data.starts_with(b"PK\x03\x04") || data.starts_with(b"PK\x05\x06") {
        return "ZIP Archive".to_string();
    }

    // RAR
    if data.starts_with(b"Rar!") {
        return "RAR Archive".to_string();
    }

    // 7-Zip
    if data.starts_with(b"7z\xbc\xaf'\x1c") {
        return "7-Zip Archive".to_string();
    }

    // GZ / tar.gz
    if data.starts_with(b"\x1f\x8b") {
        return "GZip Archive".to_string();
    }

    // BZ2
    if data.starts_with(b"BZh") {
        return "BZip2 Archive".to_string();
    }

    // XZ
    if data.starts_with(b"\xfd7zXZ\x00") {
        return "XZ Archive".to_string();
    }

    // Java class file
    if data.starts_with(b"\xca\xfe\xba\xbe") {
        return "Java Class".to_string();
    }

    // Mach-O (macOS / iOS binary)
    if data.starts_with(b"\xfe\xed\xfa\xce")
        || data.starts_with(b"\xfe\xed\xfa\xcf")
        || data.starts_with(b"\xce\xfa\xed\xfe")
        || data.starts_with(b"\xcf\xfa\xed\xfe")
    {
        return "Mach-O Binary".to_string();
    }

    // Microsoft Office OLE2 compound document (DOC, XLS, PPT)
    if data.starts_with(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") {
        return "OLE2 Document".to_string();
    }

    // SQLite database
    if data.starts_with(b"SQLite format 3") {
        return "SQLite Database".to_string();
    }

    // PNG
    if data.starts_with(b"\x89PNG\r\n\x1a\n") {
        return "PNG Image".to_string();
    }

    // JPEG
    if data.starts_with(b"\xff\xd8\xff") {
        return "JPEG Image".to_string();
    }

    // GIF
    if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
        return "GIF Image".to_string();
    }

    // WebP
    if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        return "WebP Image".to_string();
    }

    // MP3
    if data.starts_with(b"ID3") || (data[0] == 0xff && (data[1] & 0xe0) == 0xe0) {
        return "MP3 Audio".to_string();
    }

    // Shell script
    if data.starts_with(b"#!/") || data.starts_with(b"#!") {
        return "Script".to_string();
    }

    // UTF-8 / plain text heuristic (all bytes printable or common whitespace)
    if data.iter().all(|&b| b == b'\r' || b == b'\n' || b == b'\t' || ((0x20u8..0x7fu8).contains(&b))) {
        return "Plain Text".to_string();
    }

    "Unknown Binary".to_string()
}

/// Format a file size into a human-readable string (B / KB / MB / GB).
pub fn format_file_size(size: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;
    if size >= GB {
        format!("{:.2} GB", size as f64 / GB as f64)
    } else if size >= MB {
        format!("{:.2} MB", size as f64 / MB as f64)
    } else if size >= KB {
        format!("{:.2} KB", size as f64 / KB as f64)
    } else {
        format!("{} B", size)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_known() {
        // SHA-256 of empty string
        let hash = compute_sha256(b"");
        assert_eq!(
            hash,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn test_entropy_uniform() {
        // A buffer where all 256 byte values appear equally — maximum entropy.
        let data: Vec<u8> = (0u8..=255).collect();
        let e = compute_entropy(&data);
        assert!((e - 8.0).abs() < 0.01, "expected ~8.0, got {}", e);
    }

    #[test]
    fn test_entropy_constant() {
        let data = vec![0u8; 1000];
        let e = compute_entropy(&data);
        assert!(e < 0.001, "expected ~0, got {}", e);
    }

    #[test]
    fn test_detect_pe() {
        let mut data = vec![0u8; 256];
        data[0] = b'M';
        data[1] = b'Z';
        // PE offset at byte 60 (little-endian) = 128
        data[60] = 128;
        data[128] = b'P';
        data[129] = b'E';
        data[130] = 0;
        data[131] = 0;
        assert_eq!(detect_file_type(&data), "PE Executable");
    }

    #[test]
    fn test_detect_elf() {
        let data = b"\x7fELF\x02\x01\x01\x00";
        assert_eq!(detect_file_type(data), "ELF Binary");
    }

    #[test]
    fn test_detect_pdf() {
        let data = b"%PDF-1.4 header";
        assert_eq!(detect_file_type(data), "PDF Document");
    }
}
