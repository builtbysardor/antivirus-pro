from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import aiofiles

from backend.core.security import QUARANTINE_DIR
from backend.models import ScanResult

logger = logging.getLogger(__name__)

_XOR_KEY = 0xFF


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _xor_bytes(data: bytes) -> bytes:
    """Apply XOR 0xFF obfuscation (symmetric — same function decrypts)."""
    return bytes(b ^ _XOR_KEY for b in data)


def _quarantine_name(scan_id: str, original_filename: str) -> str:
    """Build a deterministic quarantine filename that embeds the scan_id."""
    stem = Path(original_filename).stem[:40]
    suffix = Path(original_filename).suffix
    return f"{scan_id}__{stem}{suffix}.quar"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def quarantine_file(
    scan_result: ScanResult,
    reason: str = "",
    source_path: Optional[Path] = None,
) -> str:
    """Move a file identified by *scan_result* into QUARANTINE_DIR.

    The file content is XOR-obfuscated with 0xFF so that the OS's on-access
    scanner cannot re-flag it while it sits in quarantine.

    *source_path* is the path to the actual file to quarantine.  When provided
    and the file exists, the content is read, XOR-obfuscated, written to the
    quarantine directory, and the source is deleted.  If it is not provided (or
    the file no longer exists) an empty placeholder is written so the DB record
    remains consistent.

    Returns the absolute path of the quarantined file.
    """
    QUARANTINE_DIR.mkdir(parents=True, exist_ok=True)

    if scan_result.quarantine_path and Path(scan_result.quarantine_path).exists():
        # Already quarantined — just return the existing path.
        return scan_result.quarantine_path

    quar_name = _quarantine_name(scan_result.scan_id, scan_result.filename)
    dest_path = QUARANTINE_DIR / quar_name

    # ------------------------------------------------------------------
    # Write metadata sidecar (.meta.json) — JSON format for easy parsing
    # ------------------------------------------------------------------
    meta_path = dest_path.with_suffix(".meta.json")
    meta: dict[str, Any] = {
        "scan_id": scan_result.scan_id,
        "original_filename": scan_result.filename,
        "sha256": scan_result.sha256,
        "threat_level": scan_result.threat_level.value,
        "quarantined_at": datetime.utcnow().isoformat(),
        "reason": reason,
        "quarantine_path": str(dest_path),
    }
    async with aiofiles.open(meta_path, "w", encoding="utf-8") as mf:
        await mf.write(json.dumps(meta, indent=2))

    # ------------------------------------------------------------------
    # XOR-obfuscate and write the file content
    # ------------------------------------------------------------------
    if source_path is not None and Path(source_path).exists():
        async with aiofiles.open(source_path, "rb") as src:
            raw = await src.read()
        obfuscated = _xor_bytes(raw)
        async with aiofiles.open(dest_path, "wb") as dst:
            await dst.write(obfuscated)
        # Remove the source now that it is safely quarantined.
        try:
            Path(source_path).unlink()
        except OSError as exc:
            logger.warning("Could not remove source after quarantine: %s", exc)
    else:
        # No source file available: create an empty placeholder so the path
        # is still unique and trackable.
        logger.warning(
            "quarantine_file: source_path not provided or missing for %s; "
            "writing empty placeholder",
            scan_result.filename,
        )
        async with aiofiles.open(dest_path, "wb") as dst:
            await dst.write(b"")

    logger.info(
        "Quarantined %s → %s (reason: %s)",
        scan_result.filename,
        dest_path,
        reason or "none",
    )
    return str(dest_path)


async def restore_file(quarantine_path: str, restore_path: str) -> None:
    """Decrypt (XOR 0xFF) a quarantined file and write it to *restore_path*.

    If a .meta.json sidecar exists, the original filename from metadata is used
    when the restore_path points to a directory.

    Raises :class:`FileNotFoundError` if the quarantine file does not exist.
    """
    src = Path(quarantine_path)
    if not src.exists():
        raise FileNotFoundError(f"Quarantine file not found: {quarantine_path}")

    dst = Path(restore_path)

    # If restore_path is a directory, use the original filename from metadata.
    if dst.is_dir() or not dst.suffix:
        meta_path = src.with_suffix(".meta.json")
        if meta_path.exists():
            try:
                async with aiofiles.open(meta_path, "r", encoding="utf-8") as mf:
                    meta = json.loads(await mf.read())
                original_filename = meta.get("original_filename", src.stem)
                dst = dst / original_filename
            except Exception as exc:
                logger.warning("Could not read meta.json for restore path: %s", exc)
                dst = dst / src.stem

    dst.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(src, "rb") as fh:
        obfuscated = await fh.read()

    restored = _xor_bytes(obfuscated)

    async with aiofiles.open(dst, "wb") as fh:
        await fh.write(restored)

    logger.info("Restored quarantined file %s → %s", quarantine_path, dst)


async def delete_quarantined(quarantine_path: str) -> None:
    """Permanently delete a quarantined file and its metadata sidecar."""
    qpath = Path(quarantine_path)
    errors: list[str] = []

    # Support both the old .meta and the new .meta.json sidecar names.
    sidecars = [
        qpath.with_suffix(".meta.json"),
        qpath.with_suffix(".meta"),
    ]

    for path in [qpath, *sidecars]:
        if path.exists():
            try:
                path.unlink()
                logger.info("Deleted quarantine file %s", path)
            except OSError as exc:
                errors.append(str(exc))
                logger.error("Failed to delete %s: %s", path, exc)

    if errors:
        raise OSError("; ".join(errors))


async def list_quarantine() -> list[dict[str, Any]]:
    """Return metadata for every file currently in QUARANTINE_DIR.

    Each entry is a dict with keys from the .meta.json sidecar plus:
      filename, quarantine_path, meta_path, size_bytes, modified_at.
    """
    QUARANTINE_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []

    for entry in sorted(QUARANTINE_DIR.iterdir()):
        if entry.suffix != ".quar":
            continue

        stat = entry.stat()
        info: dict[str, Any] = {
            "filename": entry.name,
            "quarantine_path": str(entry),
            "size_bytes": stat.st_size,
            "modified_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
        }

        # Prefer .meta.json; fall back to legacy .meta (key=value format).
        meta_json = entry.with_suffix(".meta.json")
        meta_legacy = entry.with_suffix(".meta")

        if meta_json.exists():
            info["meta_path"] = str(meta_json)
            try:
                async with aiofiles.open(meta_json, "r", encoding="utf-8") as mf:
                    meta = json.loads(await mf.read())
                info.update(meta)
            except Exception as exc:
                logger.warning("Could not parse meta.json for %s: %s", entry, exc)
        elif meta_legacy.exists():
            info["meta_path"] = str(meta_legacy)
            try:
                async with aiofiles.open(meta_legacy, "r", encoding="utf-8") as mf:
                    for line in (await mf.read()).splitlines():
                        if "=" in line:
                            key, _, value = line.partition("=")
                            info[key.strip()] = value.strip()
            except Exception as exc:
                logger.warning("Could not parse .meta for %s: %s", entry, exc)

        results.append(info)

    return results
