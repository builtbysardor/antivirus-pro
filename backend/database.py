from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import aiosqlite

from backend.models import ScanResult, ScanStatus, ThreatLevel

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "./antivirus.db")


async def init_db() -> None:
    """Initialize the SQLite database and create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS scan_results (
                scan_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                sha256 TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                threat_level TEXT NOT NULL DEFAULT 'unknown',
                engines_used TEXT NOT NULL DEFAULT '[]',
                heuristic_result TEXT,
                cloud_results TEXT NOT NULL DEFAULT '[]',
                threat_names TEXT NOT NULL DEFAULT '[]',
                scan_duration_ms INTEGER NOT NULL DEFAULT 0,
                scanned_at TEXT NOT NULL,
                quarantined INTEGER NOT NULL DEFAULT 0,
                quarantine_path TEXT,
                error_message TEXT
            )
            """
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_scanned_at ON scan_results (scanned_at)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_threat_level ON scan_results (threat_level)"
        )
        await db.commit()
    logger.info("Database initialized at %s", DB_PATH)


def _row_to_scan_result(row: aiosqlite.Row) -> ScanResult:
    """Convert a DB row (dict-like) to a ScanResult model."""
    return ScanResult.model_validate(
        {
            "scan_id": row["scan_id"],
            "filename": row["filename"],
            "file_size": row["file_size"],
            "sha256": row["sha256"],
            "status": row["status"],
            "threat_level": row["threat_level"],
            "engines_used": json.loads(row["engines_used"]),
            "heuristic_result": json.loads(row["heuristic_result"])
            if row["heuristic_result"]
            else None,
            "cloud_results": json.loads(row["cloud_results"]),
            "threat_names": json.loads(row["threat_names"]),
            "scan_duration_ms": row["scan_duration_ms"],
            "scanned_at": row["scanned_at"],
            "quarantined": bool(row["quarantined"]),
            "quarantine_path": row["quarantine_path"],
            "error_message": row["error_message"],
        }
    )


async def save_scan_result(result: ScanResult) -> None:
    """Insert or replace a scan result in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO scan_results (
                scan_id, filename, file_size, sha256, status, threat_level,
                engines_used, heuristic_result, cloud_results, threat_names,
                scan_duration_ms, scanned_at, quarantined, quarantine_path,
                error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.scan_id,
                result.filename,
                result.file_size,
                result.sha256,
                result.status.value,
                result.threat_level.value,
                json.dumps([e.value for e in result.engines_used]),
                json.dumps(result.heuristic_result.model_dump())
                if result.heuristic_result
                else None,
                json.dumps(
                    [r.model_dump() for r in result.cloud_results]
                ),
                json.dumps(result.threat_names),
                result.scan_duration_ms,
                result.scanned_at.isoformat(),
                int(result.quarantined),
                result.quarantine_path,
                result.error_message,
            ),
        )
        await db.commit()
    logger.debug("Saved scan result %s", result.scan_id)


async def get_scan_result(scan_id: str) -> Optional[ScanResult]:
    """Retrieve a single scan result by scan_id."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM scan_results WHERE scan_id = ?", (scan_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            return _row_to_scan_result(row)


async def get_scan_history(
    limit: int = 50, offset: int = 0
) -> tuple[List[ScanResult], int]:
    """Return a page of scan results and the total count."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT COUNT(*) FROM scan_results") as cursor:
            row = await cursor.fetchone()
            total = row[0] if row else 0

        async with db.execute(
            "SELECT * FROM scan_results ORDER BY scanned_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ) as cursor:
            rows = await cursor.fetchall()
            items = [_row_to_scan_result(r) for r in rows]

    return items, total


async def get_quarantined_files() -> List[ScanResult]:
    """Return all quarantined scan results."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM scan_results WHERE quarantined = 1 ORDER BY scanned_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [_row_to_scan_result(r) for r in rows]


async def update_quarantine_status(
    scan_id: str, quarantined: bool, quarantine_path: Optional[str] = None
) -> None:
    """Update quarantine fields for an existing scan result."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE scan_results SET quarantined = ?, quarantine_path = ? WHERE scan_id = ?",
            (int(quarantined), quarantine_path, scan_id),
        )
        await db.commit()


async def get_stats() -> Dict[str, Any]:
    """Return aggregate statistics for the dashboard."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT COUNT(*) as cnt FROM scan_results") as cur:
            total_scans = (await cur.fetchone())["cnt"]

        async with db.execute(
            "SELECT COUNT(*) as cnt FROM scan_results WHERE threat_level = 'clean'"
        ) as cur:
            clean_count = (await cur.fetchone())["cnt"]

        async with db.execute(
            "SELECT COUNT(*) as cnt FROM scan_results WHERE threat_level = 'suspicious'"
        ) as cur:
            suspicious_count = (await cur.fetchone())["cnt"]

        async with db.execute(
            "SELECT COUNT(*) as cnt FROM scan_results WHERE threat_level = 'malicious'"
        ) as cur:
            malicious_count = (await cur.fetchone())["cnt"]

        async with db.execute(
            "SELECT COUNT(*) as cnt FROM scan_results WHERE quarantined = 1"
        ) as cur:
            quarantine_count = (await cur.fetchone())["cnt"]

        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        async with db.execute(
            "SELECT COUNT(*) as cnt FROM scan_results WHERE scanned_at >= ?",
            (cutoff,),
        ) as cur:
            last_24h_scans = (await cur.fetchone())["cnt"]

        # Top threats: expand JSON arrays and count occurrences
        async with db.execute(
            "SELECT threat_names FROM scan_results WHERE threat_names != '[]'"
        ) as cur:
            rows = await cur.fetchall()

        # Fetch last scan time
        async with db.execute(
            "SELECT scanned_at FROM scan_results ORDER BY scanned_at DESC LIMIT 1"
        ) as cur:
            last_row = await cur.fetchone()
        last_scan_time = last_row["scanned_at"] if last_row else None

    threat_counter: Dict[str, int] = {}
    for row in rows:
        try:
            names: List[str] = json.loads(row["threat_names"])
            for name in names:
                if name:
                    threat_counter[name] = threat_counter.get(name, 0) + 1
        except (json.JSONDecodeError, TypeError):
            pass

    top_threats = [
        {"name": name, "count": count}
        for name, count in sorted(
            threat_counter.items(), key=lambda x: x[1], reverse=True
        )[:10]
    ]

    return {
        "total_scans": total_scans,
        "clean_files": clean_count,
        "threats_found": suspicious_count + malicious_count,
        "quarantined_count": quarantine_count,
        "engine_status": "active",
        "last_scan_time": last_scan_time,
        "scans_today": last_24h_scans,
        "malicious_count": malicious_count,
        "suspicious_count": suspicious_count,
    }
