from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum


class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    FLAGGED = "flagged"
    NEEDS_REVIEW = "needs_review"


class EvidenceType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    DOCUMENT = "document"
    SIGNATURE = "signature"
    GPS = "gps"
    SENSOR = "sensor"
    AUDIO = "audio"


class OCRResult(BaseModel):
    text: str
    confidence: float
    raw_confidence: Optional[float] = None
    language: str = "eng"
    character_count: int = 0
    word_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VisionDetection(BaseModel):
    class_name: str
    confidence: float
    bounding_box: Optional[Dict[str, float]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VisionResult(BaseModel):
    detections: List[VisionDetection]
    overall_confidence: float
    image_quality: float
    is_blurry: bool
    has_faces: bool
    face_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConfidenceScoreRequest(BaseModel):
    evidence_id: str
    evidence_type: EvidenceType
    ocr_result: Optional[OCRResult] = None
    vision_result: Optional[VisionResult] = None
    device_info: Optional[Dict[str, Any]] = None
    location_info: Optional[Dict[str, Any]] = None


class ConfidenceScoreResult(BaseModel):
    overall_score: float
    component_scores: Dict[str, float]
    verification_status: VerificationStatus
    factors: List[str]
    recommendations: List[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AnomalyDetectionRequest(BaseModel):
    evidence_id: str
    evidence_type: EvidenceType
    confidence_score: float
    metadata: Dict[str, Any]
    historical_data: Optional[List[Dict[str, Any]]] = None


class AnomalyDetectionResult(BaseModel):
    is_anomalous: bool
    anomaly_score: float
    confidence: float
    anomaly_reasons: List[str]
    similar_cases: Optional[List[str]] = None
    recommendations: List[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VerificationRequest(BaseModel):
    evidence_id: str
    evidence_type: EvidenceType
    file_url: str
    file_key: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    device_info: Optional[Dict[str, Any]] = None
    location_info: Optional[Dict[str, Any]] = None


class VerificationResponse(BaseModel):
    evidence_id: str
    status: VerificationStatus
    confidence_score: float
    ocr_result: Optional[OCRResult] = None
    vision_result: Optional[VisionResult] = None
    anomaly_result: Optional[AnomalyDetectionResult] = None
    recommendations: List[str]
    verified_at: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float
