from __future__ import annotations

import asyncio
import hashlib
import logging
import uuid
from datetime import datetime
from typing import Any

import aiofiles
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, WebSocket, WebSocketDisconnect

from backend.core.security import TEMP_DIR, sanitize_filename, validate_file
from backend.database import (
    get_scan_history,
    get_scan_result,
    save_scan_result,
)
from backend.models import (
    ScanHistoryResponse,
    ScanResult,
    ScanStatus,
    ThreatLevel,
    WebSocketEvent,
)
from backend.services.scanner import active_scans, run_scan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scan", tags=["scan"])


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------


class ConnectionManager:
    """Manages per-scan-id WebSocket connections."""

    def __init__(self) -> None:
        # scan_id → list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, scan_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(scan_id, []).append(ws)
        logger.debug("WebSocket connected for scan %s", scan_id)

    async def disconnect(self, scan_id: str, ws: WebSocket) -> None:
        connections = self._connections.get(scan_id, [])
        if ws in connections:
            connections.remove(ws)
        if not connections:
            self._connections.pop(scan_id, None)
        logger.debug("WebSocket disconnected for scan %s", scan_id)

    async def send_event(self, scan_id: str, event: WebSocketEvent) -> None:
        """Send *event* to all clients subscribed to *scan_id*."""
        connections = list(self._connections.get(scan_id, []))
        dead: list[WebSocket] = []
        payload = event.model_dump(mode="json")
        for ws in connections:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(scan_id, ws)

    async def broadcast(self, event: WebSocketEvent) -> None:
        """Send *event* to every connected WebSocket client."""
        for scan_id in list(self._connections):
            await self.send_event(scan_id, event)


# Module-level singleton; main.py attaches it to app.state as well.
manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Helper: compute sha256 of an UploadFile without loading it twice
# ---------------------------------------------------------------------------


async def _sha256_of_file(file: UploadFile) -> tuple[str, bytes]:
    """Read the upload, compute sha256, seek back to 0.  Returns (hex, content)."""
    content = await file.read()
    digest = hashlib.sha256(content).hexdigest()
    await file.seek(0)
    return digest, content


# ---------------------------------------------------------------------------
# Background wrapper
# ---------------------------------------------------------------------------


async def _scan_background(
    scan_id: str,
    file_path_str: str,
    filename: str,
    file_size: int,
    sha256: str,
) -> None:
    """Launched as a background coroutine wrapped in an asyncio.Task."""
    from pathlib import Path  # local import avoids circular at module level

    task = asyncio.current_task()
    if task is not None:
        active_scans[scan_id] = task

    try:
        await run_scan(
            scan_id=scan_id,
            file_path=Path(file_path_str),
            filename=filename,
            file_size=file_size,
            sha256=sha256,
            websocket_manager=manager,
        )
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        logger.exception("Background scan %s failed: %s", scan_id, exc)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/upload", summary="Upload a file for scanning")
async def upload_file(
    file: UploadFile,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Accept a file upload, validate it, persist a pending DB record, and
    launch an async background scan.

    Returns ``{"scan_id": <uuid>, "status": "pending"}``.
    """
    # Validate size and filename — returns full content (streaming, no double-read)
    content = await validate_file(file)
    sha256 = hashlib.sha256(content).hexdigest()
    file_size = len(content)

    # Sanitise filename and build a unique temp path
    safe_name = sanitize_filename(file.filename or "upload")
    scan_id = str(uuid.uuid4())
    temp_filename = f"{scan_id}__{safe_name}"
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = TEMP_DIR / temp_filename

    # Write the upload to disk
    async with aiofiles.open(temp_path, "wb") as fh:
        await fh.write(content)

    # Create and persist a pending ScanResult immediately so callers can poll
    pending_result = ScanResult(
        scan_id=scan_id,
        filename=safe_name,
        file_size=file_size,
        sha256=sha256,
        status=ScanStatus.pending,
        scanned_at=datetime.utcnow(),
    )
    await save_scan_result(pending_result)

    # Launch the scan as an asyncio Task (not a FastAPI BackgroundTask so we
    # can cancel it later via active_scans).
    task = asyncio.create_task(
        _scan_background(
            scan_id=scan_id,
            file_path_str=str(temp_path),
            filename=safe_name,
            file_size=file_size,
            sha256=sha256,
        ),
        name=f"scan-{scan_id}",
    )
    active_scans[scan_id] = task

    return {"scan_id": scan_id, "status": ScanStatus.pending.value}


@router.get("/history", summary="List scan history", response_model=ScanHistoryResponse)
async def scan_history(limit: int = 50, offset: int = 0) -> ScanHistoryResponse:
    """Return a paginated list of past scan results."""
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500.")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be >= 0.")

    items, total = await get_scan_history(limit=limit, offset=offset)
    return ScanHistoryResponse(items=items, total=total)


@router.get("/{scan_id}", summary="Get scan result", response_model=ScanResult)
async def get_scan(scan_id: str) -> ScanResult:
    """Return the scan result for the given *scan_id*."""
    result = await get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found.")
    return result


@router.delete("/{scan_id}", summary="Delete a scan record")
async def delete_scan(scan_id: str) -> dict[str, str]:
    """Remove a scan result from the database.

    If the scan is still running it is cancelled first.
    """
    from backend.services.scanner import cancel_scan

    await cancel_scan(scan_id)

    result = await get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found.")

    import aiosqlite
    from backend.database import DB_PATH

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM scan_results WHERE scan_id = ?", (scan_id,))
        await db.commit()

    return {"scan_id": scan_id, "deleted": "true"}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@router.websocket("/ws/{scan_id}")
async def websocket_scan_progress(ws: WebSocket, scan_id: str) -> None:
    """Stream scan progress events to the client.

    Events are JSON objects matching :class:`~backend.models.WebSocketEvent`:

    .. code-block:: json

        {
            "event_type": "progress",
            "scan_id": "...",
            "progress": 42,
            "message": "Running heuristic engine",
            "data": {}
        }

    The final event has ``event_type`` = ``"completed"`` or ``"failed"`` and
    includes the full :class:`~backend.models.ScanResult` in ``data``.
    """
    await manager.connect(scan_id, ws)

    # If the scan is already finished, send the result immediately and close.
    try:
        existing = await get_scan_result(scan_id)
        if existing is not None and existing.status in (
            ScanStatus.completed,
            ScanStatus.failed,
        ):
            event_type = (
                "completed" if existing.status == ScanStatus.completed else "failed"
            )
            await ws.send_json(
                WebSocketEvent(
                    event_type=event_type,
                    scan_id=scan_id,
                    progress=100,
                    message="Scan already finished.",
                    data=existing.model_dump(mode="json"),
                ).model_dump(mode="json")
            )
            await ws.close()
            return

        # Keep the connection open and wait for the scanner to push events.
        # The scanner calls manager.send_event() which drives our sends; here
        # we just keep the coroutine alive until the client disconnects or the
        # connection is closed server-side.
        while True:
            try:
                # We don't expect messages from the client but we need to
                # detect a clean disconnect.
                data = await asyncio.wait_for(ws.receive_text(), timeout=60.0)
                if data == "ping":
                    await ws.send_text("pong")
            except asyncio.TimeoutError:
                # Send a keepalive ping
                try:
                    await ws.send_json(
                        {"event_type": "ping", "scan_id": scan_id, "progress": 0, "message": "", "data": {}}
                    )
                except Exception:
                    break
            except WebSocketDisconnect:
                break
            except Exception:
                break

    finally:
        await manager.disconnect(scan_id, ws)
