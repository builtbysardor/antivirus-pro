from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Optional

import aiofiles
import httpx

from backend.core.security import RUST_SCANNER_PATH
from backend.database import save_scan_result
from backend.models import (
    CloudEngineResult,
    HeuristicResult,
    ScanEngine,
    ScanResult,
    ScanStatus,
    ThreatLevel,
    WebSocketEvent,
)

if TYPE_CHECKING:
    from backend.routers.scan import ConnectionManager

logger = logging.getLogger(__name__)

# Registry of in-flight scan tasks keyed by scan_id
active_scans: dict[str, asyncio.Task] = {}

VIRUSTOTAL_API_KEY: Optional[str] = os.getenv("VIRUSTOTAL_API_KEY")
_VT_BASE = "https://www.virustotal.com/api/v3"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_rust_output(raw: str, filename: str) -> HeuristicResult:
    """Parse the JSON blob emitted by the Rust scanner into a HeuristicResult."""
    try:
        data: dict = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Rust scanner produced non-JSON output; using defaults.")
        return HeuristicResult()

    return HeuristicResult(
        entropy=float(data.get("entropy", 0.0)),
        is_packed=bool(data.get("is_packed", False)),
        suspicious_strings=list(data.get("suspicious_strings", [])),
        magic_bytes=data.get("magic_bytes"),
        has_pe_header=bool(data.get("has_pe_header", False)),
        threat_score=float(data.get("threat_score", 0.0)),
        details=data.get("details", {}),
    )


def _threat_level_from_heuristic(h: HeuristicResult) -> ThreatLevel:
    """Derive an overall ThreatLevel from the heuristic result."""
    if h.threat_score >= 0.75:
        return ThreatLevel.malicious
    if h.threat_score >= 0.40:
        return ThreatLevel.suspicious
    return ThreatLevel.clean


def _mock_heuristic() -> HeuristicResult:
    """Return a harmless mock HeuristicResult used in dev mode."""
    return HeuristicResult(
        entropy=0.0,
        is_packed=False,
        suspicious_strings=[],
        magic_bytes=None,
        has_pe_header=False,
        threat_score=0.0,
        details={"mode": "mock"},
    )


async def _emit(
    websocket_manager: "ConnectionManager",
    scan_id: str,
    progress: int,
    message: str,
    data: dict | None = None,
    event_type: str = "progress",
) -> None:
    """Fire a WebSocket event and swallow any connection errors."""
    try:
        await websocket_manager.send_event(
            scan_id,
            WebSocketEvent(
                event_type=event_type,
                scan_id=scan_id,
                progress=progress,
                message=message,
                data=data or {},
            ),
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("WebSocket emit failed for %s: %s", scan_id, exc)


# ---------------------------------------------------------------------------
# VirusTotal integration
# ---------------------------------------------------------------------------


async def _virustotal_scan(
    file_path: Path,
    filename: str,
) -> Optional[CloudEngineResult]:
    """Submit a file to VirusTotal and poll for the result.

    Returns *None* if the API key is absent, the upload fails, or the
    analysis is not ready within a reasonable timeout.
    """
    if not VIRUSTOTAL_API_KEY:
        return None

    headers = {"x-apikey": VIRUSTOTAL_API_KEY}

    async with httpx.AsyncClient(timeout=60.0) as client:
        # --- upload ---
        try:
            async with aiofiles.open(file_path, "rb") as fh:
                content = await fh.read()

            upload_resp = await client.post(
                f"{_VT_BASE}/files",
                headers=headers,
                files={"file": (filename, content, "application/octet-stream")},
            )
            upload_resp.raise_for_status()
        except Exception as exc:
            logger.error("VirusTotal upload failed: %s", exc)
            return None

        analysis_id: str = upload_resp.json()["data"]["id"]

        # --- poll up to 10 times with 6-second back-off ---
        for attempt in range(10):
            await asyncio.sleep(6)
            try:
                poll_resp = await client.get(
                    f"{_VT_BASE}/analyses/{analysis_id}",
                    headers=headers,
                )
                poll_resp.raise_for_status()
            except Exception as exc:
                logger.warning("VirusTotal poll attempt %d failed: %s", attempt, exc)
                continue

            body = poll_resp.json()
            status = body.get("data", {}).get("attributes", {}).get("status")
            if status != "completed":
                continue

            attrs = body["data"]["attributes"]
            stats: dict = attrs.get("stats", {})
            detections: int = stats.get("malicious", 0) + stats.get("suspicious", 0)
            total: int = sum(stats.values()) if stats else 0

            threat_names: list[str] = []
            for result in attrs.get("results", {}).values():
                name = result.get("result")
                if name and name not in threat_names:
                    threat_names.append(name)

            if detections > 0:
                if stats.get("malicious", 0) > 0:
                    level = ThreatLevel.malicious
                else:
                    level = ThreatLevel.suspicious
            else:
                level = ThreatLevel.clean

            permalink = (
                body.get("data", {}).get("links", {}).get("self")
                or f"https://www.virustotal.com/gui/file/{analysis_id}"
            )

            return CloudEngineResult(
                engine="virustotal",
                threat_level=level,
                detections=detections,
                total_engines=total,
                threat_names=threat_names,
                scan_date=datetime.utcnow().isoformat(),
                permalink=permalink,
                raw=attrs,
            )

        logger.warning("VirusTotal analysis not completed in time for %s", filename)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def run_scan(
    scan_id: str,
    file_path: Path,
    filename: str,
    file_size: int,
    sha256: str,
    websocket_manager: "ConnectionManager",
) -> ScanResult:
    """Execute a full scan pipeline and return the finalised ScanResult.

    Stages
    ------
    1. Heuristic scan via Rust binary (or mock in dev mode)  [0 → 60 %]
    2. Optional VirusTotal cloud scan                        [60 → 90 %]
    3. Persist result and clean up temp file                 [90 → 100 %]
    """
    start_ms = int(time.monotonic() * 1000)

    # Build the in-progress record that already lives in the DB (status=pending).
    result = ScanResult(
        scan_id=scan_id,
        filename=filename,
        file_size=file_size,
        sha256=sha256,
        status=ScanStatus.scanning,
        scanned_at=datetime.utcnow(),
    )

    await _emit(websocket_manager, scan_id, 5, "Scan started", event_type="progress")

    try:
        # ------------------------------------------------------------------
        # Stage 1 — Heuristic / Rust scanner
        # ------------------------------------------------------------------
        heuristic_result: HeuristicResult
        engines_used: list[ScanEngine] = []

        if RUST_SCANNER_PATH.exists():
            await _emit(websocket_manager, scan_id, 10, "Running heuristic engine")
            try:
                proc = await asyncio.create_subprocess_exec(
                    str(RUST_SCANNER_PATH),
                    "scan",
                    str(file_path),
                    "--json",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
                if proc.returncode != 0:
                    logger.warning(
                        "Rust scanner exited %d: %s",
                        proc.returncode,
                        stderr.decode(errors="replace"),
                    )
                heuristic_result = _parse_rust_output(
                    stdout.decode(errors="replace"), filename
                )
            except asyncio.TimeoutError:
                logger.error("Rust scanner timed out for %s", filename)
                heuristic_result = _mock_heuristic()
            except Exception as exc:
                logger.error("Rust scanner error: %s", exc)
                heuristic_result = _mock_heuristic()
            engines_used.append(ScanEngine.heuristic)
        else:
            logger.info("Rust binary not found — using mock heuristic (dev mode).")
            heuristic_result = _mock_heuristic()
            engines_used.append(ScanEngine.heuristic)

        await _emit(websocket_manager, scan_id, 60, "Heuristic scan complete")

        threat_level = _threat_level_from_heuristic(heuristic_result)
        threat_names: list[str] = list(heuristic_result.suspicious_strings)

        # ------------------------------------------------------------------
        # Stage 2 — VirusTotal (optional)
        # ------------------------------------------------------------------
        cloud_results: list[CloudEngineResult] = []

        if VIRUSTOTAL_API_KEY:
            await _emit(
                websocket_manager, scan_id, 65, "Submitting to VirusTotal cloud engine"
            )
            vt_result = await _virustotal_scan(file_path, filename)
            if vt_result is not None:
                cloud_results.append(vt_result)
                engines_used.append(ScanEngine.virustotal)

                # Cloud verdict overrides heuristic when more severe
                severity_order = {
                    ThreatLevel.clean: 0,
                    ThreatLevel.unknown: 1,
                    ThreatLevel.suspicious: 2,
                    ThreatLevel.malicious: 3,
                }
                if severity_order[vt_result.threat_level] > severity_order[threat_level]:
                    threat_level = vt_result.threat_level

                for name in vt_result.threat_names:
                    if name not in threat_names:
                        threat_names.append(name)

        await _emit(websocket_manager, scan_id, 90, "Finalising result")

        # ------------------------------------------------------------------
        # Stage 3 — Build final result and persist
        # ------------------------------------------------------------------
        end_ms = int(time.monotonic() * 1000)
        result = ScanResult(
            scan_id=scan_id,
            filename=filename,
            file_size=file_size,
            sha256=sha256,
            status=ScanStatus.completed,
            threat_level=threat_level,
            engines_used=engines_used,
            heuristic_result=heuristic_result,
            cloud_results=cloud_results,
            threat_names=threat_names,
            scan_duration_ms=end_ms - start_ms,
            scanned_at=result.scanned_at,
        )

    except asyncio.CancelledError:
        logger.info("Scan %s was cancelled.", scan_id)
        end_ms = int(time.monotonic() * 1000)
        result = ScanResult(
            scan_id=scan_id,
            filename=filename,
            file_size=file_size,
            sha256=sha256,
            status=ScanStatus.failed,
            threat_level=ThreatLevel.unknown,
            error_message="Scan cancelled by user.",
            scan_duration_ms=end_ms - start_ms,
            scanned_at=result.scanned_at,
        )
        raise

    except Exception as exc:
        logger.exception("Unexpected error during scan %s: %s", scan_id, exc)
        end_ms = int(time.monotonic() * 1000)
        result = ScanResult(
            scan_id=scan_id,
            filename=filename,
            file_size=file_size,
            sha256=sha256,
            status=ScanStatus.failed,
            threat_level=ThreatLevel.unknown,
            error_message=str(exc),
            scan_duration_ms=end_ms - start_ms,
            scanned_at=result.scanned_at,
        )

    finally:
        # Auto-quarantine malicious files before deleting the temp file
        if result.status == ScanStatus.completed and result.threat_level == ThreatLevel.malicious:
            try:
                from backend.utils.quarantine import quarantine_file as _qfile
                from backend.database import update_quarantine_status
                qpath = await _qfile(result, reason="auto-quarantine: malicious", source_path=file_path)
                await update_quarantine_status(result.scan_id, quarantined=True, quarantine_path=qpath)
                result = result.model_copy(update={"quarantined": True, "quarantine_path": qpath})
                logger.info("Auto-quarantined malicious file %s → %s", filename, qpath)
            except Exception as exc:
                logger.error("Auto-quarantine failed for %s: %s", filename, exc)

        # Clean up the temp file (quarantine_file already deleted it if quarantined)
        try:
            if file_path.exists():
                file_path.unlink()
                logger.debug("Removed temp file %s", file_path)
        except OSError as exc:
            logger.warning("Could not remove temp file %s: %s", file_path, exc)

        await save_scan_result(result)

        event_type = (
            "completed" if result.status == ScanStatus.completed else "failed"
        )
        await _emit(
            websocket_manager,
            scan_id,
            100,
            "Scan complete" if event_type == "completed" else "Scan failed",
            data=result.model_dump(mode="json"),
            event_type=event_type,
        )

        active_scans.pop(scan_id, None)

    return result


async def cancel_scan(scan_id: str) -> bool:
    """Cancel an in-flight scan task.

    Returns *True* if the task existed and was cancelled, *False* otherwise.
    """
    task = active_scans.get(scan_id)
    if task is None or task.done():
        return False
    task.cancel()
    try:
        await asyncio.wait_for(asyncio.shield(task), timeout=5.0)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass
    active_scans.pop(scan_id, None)
    return True
