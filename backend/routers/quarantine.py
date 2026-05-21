from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.database import (
    get_quarantined_files,
    get_scan_result,
    update_quarantine_status,
)
from backend.models import DeleteQuarantineRequest, QuarantineRequest, ScanResult
from backend.utils.quarantine import (
    delete_quarantined,
    quarantine_file,
    restore_file,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quarantine", tags=["quarantine"])


class RestoreRequest(BaseModel):
    restore_path: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", summary="List quarantined files", response_model=list[ScanResult])
async def list_quarantined() -> list[ScanResult]:
    """Return all scan results that have been quarantined."""
    return await get_quarantined_files()


@router.post("/{scan_id}", summary="Quarantine a file")
async def quarantine_scan(
    scan_id: str, body: QuarantineRequest
) -> dict[str, Any]:
    """Move the file associated with *scan_id* to quarantine.

    Requires ``user_consent: true`` in the request body.
    """
    if not body.user_consent:
        raise HTTPException(
            status_code=400,
            detail="user_consent must be true to quarantine a file.",
        )

    result = await get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found.")

    if result.quarantined and result.quarantine_path:
        return {
            "scan_id": scan_id,
            "quarantine_path": result.quarantine_path,
            "message": "File was already quarantined.",
        }

    try:
        quarantine_path = await quarantine_file(result, reason=body.reason or "")
    except Exception as exc:
        logger.exception("Failed to quarantine scan %s: %s", scan_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Quarantine operation failed: {exc}",
        ) from exc

    await update_quarantine_status(
        scan_id, quarantined=True, quarantine_path=quarantine_path
    )

    return {
        "scan_id": scan_id,
        "quarantine_path": quarantine_path,
        "message": "File quarantined successfully.",
    }


@router.delete("/{scan_id}", summary="Permanently delete a quarantined file")
async def delete_quarantine(
    scan_id: str, body: DeleteQuarantineRequest
) -> dict[str, str]:
    """Permanently delete the quarantined file for *scan_id*.

    Requires ``confirm: true`` in the request body.
    """
    if not body.confirm:
        raise HTTPException(
            status_code=400,
            detail="confirm must be true to permanently delete a quarantined file.",
        )

    result = await get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found.")

    if not result.quarantined or not result.quarantine_path:
        raise HTTPException(
            status_code=400,
            detail=f"Scan '{scan_id}' does not have a quarantined file.",
        )

    try:
        await delete_quarantined(result.quarantine_path)
    except Exception as exc:
        logger.exception("Failed to delete quarantine for scan %s: %s", scan_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Delete operation failed: {exc}",
        ) from exc

    # Clear the quarantine reference in the DB but keep the scan record.
    await update_quarantine_status(scan_id, quarantined=False, quarantine_path=None)

    return {"scan_id": scan_id, "deleted": "true"}


@router.post("/{scan_id}/restore", summary="Restore a quarantined file")
async def restore_quarantine(
    scan_id: str, body: RestoreRequest
) -> dict[str, str]:
    """Decrypt and restore the quarantined file to *restore_path*.

    The file is removed from quarantine after a successful restore.
    """
    if not body.restore_path:
        raise HTTPException(status_code=400, detail="restore_path must not be empty.")

    # Prevent path traversal — only allow restoring to safe directories
    _ALLOWED_ROOTS = ("/home", "/tmp/av_restored", "/var/tmp")
    real_dest = os.path.realpath(body.restore_path)
    if not any(real_dest.startswith(root) for root in _ALLOWED_ROOTS):
        raise HTTPException(
            status_code=400,
            detail="restore_path must be under /home or /tmp/av_restored.",
        )

    result = await get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found.")

    if not result.quarantined or not result.quarantine_path:
        raise HTTPException(
            status_code=400,
            detail=f"Scan '{scan_id}' does not have a quarantined file.",
        )

    try:
        await restore_file(result.quarantine_path, body.restore_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to restore scan %s: %s", scan_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Restore operation failed: {exc}",
        ) from exc

    # Remove quarantine tracking from the DB.
    await update_quarantine_status(scan_id, quarantined=False, quarantine_path=None)

    return {
        "scan_id": scan_id,
        "restore_path": body.restore_path,
        "message": "File restored successfully.",
    }
