from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ScanEngine(str, Enum):
    heuristic = "heuristic"
    virustotal = "virustotal"
    metadefender = "metadefender"


class ThreatLevel(str, Enum):
    clean = "clean"
    suspicious = "suspicious"
    malicious = "malicious"
    unknown = "unknown"


class ScanStatus(str, Enum):
    pending = "pending"
    scanning = "scanning"
    completed = "completed"
    failed = "failed"


class HeuristicResult(BaseModel):
    entropy: float = 0.0
    is_packed: bool = False
    suspicious_strings: List[str] = Field(default_factory=list)
    magic_bytes: Optional[str] = None
    has_pe_header: bool = False
    threat_score: float = 0.0
    details: Dict[str, Any] = Field(default_factory=dict)


class CloudEngineResult(BaseModel):
    engine: str
    threat_level: ThreatLevel = ThreatLevel.unknown
    detections: int = 0
    total_engines: int = 0
    threat_names: List[str] = Field(default_factory=list)
    scan_date: Optional[str] = None
    permalink: Optional[str] = None
    raw: Dict[str, Any] = Field(default_factory=dict)


class ScanResult(BaseModel):
    scan_id: str
    filename: str
    file_size: int
    sha256: str
    status: ScanStatus = ScanStatus.pending
    threat_level: ThreatLevel = ThreatLevel.unknown
    engines_used: List[ScanEngine] = Field(default_factory=list)
    heuristic_result: Optional[HeuristicResult] = None
    cloud_results: List[CloudEngineResult] = Field(default_factory=list)
    threat_names: List[str] = Field(default_factory=list)
    scan_duration_ms: int = 0
    scanned_at: datetime = Field(default_factory=datetime.utcnow)
    quarantined: bool = False
    quarantine_path: Optional[str] = None
    error_message: Optional[str] = None


class QuarantineRequest(BaseModel):
    user_consent: bool
    reason: Optional[str] = None


class DeleteQuarantineRequest(BaseModel):
    confirm: bool = False


class WebSocketEvent(BaseModel):
    event_type: str
    scan_id: str
    progress: int = 0
    message: str = ""
    data: Dict[str, Any] = Field(default_factory=dict)


class RealtimeMonitorRequest(BaseModel):
    path: str
    enabled: bool = True


class ScanHistoryResponse(BaseModel):
    items: List[ScanResult]
    total: int


class StatsResponse(BaseModel):
    total_scans: int
    clean_files: int
    threats_found: int
    quarantined_count: int
    engine_status: str = "active"
    last_scan_time: Optional[str] = None
    scans_today: int
    malicious_count: int
    suspicious_count: int
