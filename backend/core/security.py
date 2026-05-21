from __future__ import annotations

import os
import re
import unicodedata
from pathlib import Path

from fastapi import HTTPException, UploadFile

# ---------------------------------------------------------------------------
# Path constants
# ---------------------------------------------------------------------------

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_PROJECT_DIR = _BACKEND_DIR.parent

RUST_SCANNER_PATH: Path = (
    _PROJECT_DIR / "core" / "target" / "release" / "av-core"
)

TEMP_DIR: Path = Path(os.getenv("TEMP_DIR", str(_BACKEND_DIR / "tmp")))
QUARANTINE_DIR: Path = Path(
    os.getenv("QUARANTINE_DIR", str(_BACKEND_DIR / "quarantine"))
)

# ---------------------------------------------------------------------------
# File size limit
# ---------------------------------------------------------------------------

MAX_FILE_SIZE_BYTES: int = int(os.getenv("MAX_FILE_SIZE_MB", "100")) * 1024 * 1024

# ---------------------------------------------------------------------------
# Filename sanitisation
# ---------------------------------------------------------------------------

# Characters that are never safe in filenames on any OS
_UNSAFE_CHARS_RE = re.compile(r"[^\w\s\-_\.\(\)]", re.UNICODE)
# Collapse runs of whitespace / dots that could confuse shells
_MULTI_DOT_RE = re.compile(r"\.{2,}")
_MULTI_SPACE_RE = re.compile(r"\s+")


def sanitize_filename(name: str) -> str:
    """Return a filesystem-safe version of *name*.

    Strips path components, normalises unicode, removes shell-unsafe
    characters, and collapses repeated dots/spaces.
    """
    # Strip leading/trailing whitespace and take only the final component so
    # path-traversal sequences like ../../etc/passwd become "passwd".
    name = os.path.basename(name.strip())

    # NFKC-normalise so accented chars become their ASCII equivalents where
    # possible; then encode to ASCII with replacement to drop anything exotic.
    name = unicodedata.normalize("NFKC", name)
    name = name.encode("ascii", "replace").decode("ascii")

    # Remove null bytes and control characters.
    name = "".join(ch for ch in name if ch >= " ")

    # Replace unsafe characters with underscores.
    name = _UNSAFE_CHARS_RE.sub("_", name)

    # Collapse path separators that survived the basename call.
    name = name.replace("/", "_").replace("\\", "_")

    # Collapse multiple consecutive dots (potential extension-spoofing).
    name = _MULTI_DOT_RE.sub(".", name)

    # Collapse whitespace runs into a single space.
    name = _MULTI_SPACE_RE.sub(" ", name).strip()

    # Ensure we have at least something usable.
    if not name or name in (".", ".."):
        name = "unnamed_file"

    # Truncate to a reasonable length (255 bytes is the ext4/NTFS limit).
    if len(name.encode("utf-8")) > 240:
        stem, _, suffix = name.rpartition(".")
        suffix = "." + suffix if suffix else ""
        name = stem[: 240 - len(suffix.encode("utf-8"))] + suffix

    return name


# ---------------------------------------------------------------------------
# Upload validation
# ---------------------------------------------------------------------------

async def validate_file(file: UploadFile) -> bytes:
    """Validate *file* and return its content as bytes.

    Enforces:
    - Non-empty filename
    - Streaming size check ≤ MAX_FILE_SIZE_BYTES (no full-RAM read before check)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    chunks: list[bytes] = []
    received = 0
    chunk_size = 1024 * 1024  # 1 MB

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        received += len(chunk)
        if received > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"File too large (limit: {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB)."
                ),
            )
        chunks.append(chunk)

    return b"".join(chunks)
