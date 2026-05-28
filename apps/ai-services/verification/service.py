import logging
from typing import Optional, Dict, Any
from datetime import datetime
from shared.models import (
    VerificationRequest,
    VerificationResponse,
    ConfidenceScoreRequest,
    ConfidenceScoreResult,
    VerificationStatus,
    EvidenceType,
    OCRResult,
    VisionResult,
)
from ocr.service import ocr_service
from vision.service import vision_service

logger = logging.getLogger(__name__)


class VerificationService:
    def __init__(self):
        self.ocr_service = ocr_service
        self.vision_service = vision_service

    async def verify_evidence(
        self,
        request: VerificationRequest,
    ) -> VerificationResponse:
        try:
            logger.info(f"Starting verification for evidence {request.evidence_id}")

            ocr_result = None
            vision_result = None
            anomaly_result = None

            # Fetch file data (in production, would fetch from S3)
            file_data = await self._fetch_file(request.file_url, request.file_key)

            # Process based on evidence type
            if request.evidence_type == EvidenceType.DOCUMENT:
                ocr_result = await self.ocr_service.extract_text(file_data)

            elif request.evidence_type == EvidenceType.PHOTO:
                vision_result = await self.vision_service.detect_objects(file_data)

            elif request.evidence_type == EvidenceType.SIGNATURE:
                vision_result = await self.vision_service.detect_objects(file_data)

            # Calculate confidence score
            confidence_request = ConfidenceScoreRequest(
                evidence_id=request.evidence_id,
                evidence_type=request.evidence_type,
                ocr_result=ocr_result,
                vision_result=vision_result,
                device_info=request.metadata.get("device_info"),
                location_info=request.metadata.get("location_info"),
            )

            confidence_result = await self._calculate_confidence(confidence_request)

            # Run anomaly detection if confidence meets threshold
            recommendations = self._generate_recommendations(
                request.evidence_type,
                confidence_result,
                ocr_result,
                vision_result,
            )

            return VerificationResponse(
                evidence_id=request.evidence_id,
                status=confidence_result.verification_status,
                confidence_score=confidence_result.overall_score,
                ocr_result=ocr_result,
                vision_result=vision_result,
                anomaly_result=anomaly_result,
                recommendations=recommendations,
                verified_at=datetime.utcnow().isoformat(),
                metadata={
                    "component_scores": confidence_result.component_scores,
                    "processing_factors": confidence_result.factors,
                },
            )

        except Exception as e:
            logger.error(f"Verification failed for {request.evidence_id}: {e}")
            raise

    async def _calculate_confidence(
        self,
        request: ConfidenceScoreRequest,
    ) -> ConfidenceScoreResult:
        component_scores = {}
        factors = []

        # OCR-based scoring
        if request.ocr_result:
            component_scores["ocr"] = request.ocr_result.confidence
            if request.ocr_result.confidence > 0.9:
                factors.append("high_ocr_confidence")
            elif request.ocr_result.confidence < 0.6:
                factors.append("low_ocr_confidence")

        # Vision-based scoring
        if request.vision_result:
            component_scores["vision"] = request.vision_result.overall_confidence
            component_scores["image_quality"] = request.vision_result.image_quality

            if request.vision_result.is_blurry:
                factors.append("blurry_image")
            if request.vision_result.has_faces:
                factors.append("contains_faces")

        # Device info scoring
        if request.device_info:
            device_score = self._score_device_info(request.device_info)
            component_scores["device"] = device_score
            if device_score < 0.5:
                factors.append("suspicious_device")

        # Location info scoring
        if request.location_info:
            location_score = self._score_location_info(request.location_info)
            component_scores["location"] = location_score

        # Calculate overall score (weighted average)
        overall_score = self._calculate_weighted_score(component_scores)

        # Determine status
        if overall_score >= 0.85:
            status = VerificationStatus.VERIFIED
        elif overall_score >= 0.65:
            status = VerificationStatus.NEEDS_REVIEW
        else:
            status = VerificationStatus.FLAGGED

        recommendations = self._generate_recommendations_from_factors(factors)

        return ConfidenceScoreResult(
            overall_score=overall_score,
            component_scores=component_scores,
            verification_status=status,
            factors=factors,
            recommendations=recommendations,
            metadata={
                "calculation_timestamp": datetime.utcnow().isoformat(),
            },
        )

    def _score_device_info(self, device_info: Dict[str, Any]) -> float:
        score = 0.8
        if device_info.get("is_jailbroken"):
            score -= 0.3
        if device_info.get("has_root_access"):
            score -= 0.2
        if device_info.get("is_emulator"):
            score -= 0.25
        return max(score, 0.0)

    def _score_location_info(self, location_info: Dict[str, Any]) -> float:
        accuracy = location_info.get("accuracy", 100)
        if accuracy > 50:
            return 0.6
        elif accuracy > 20:
            return 0.8
        else:
            return 0.95

    def _calculate_weighted_score(self, component_scores: Dict[str, float]) -> float:
        if not component_scores:
            return 0.5

        weights = {
            "ocr": 0.3,
            "vision": 0.3,
            "image_quality": 0.15,
            "device": 0.15,
            "location": 0.1,
        }

        weighted_sum = 0.0
        total_weight = 0.0

        for component, score in component_scores.items():
            weight = weights.get(component, 0.1)
            weighted_sum += score * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0.5

    def _generate_recommendations_from_factors(self, factors: list) -> list:
        recommendations = []

        factor_recommendations = {
            "low_ocr_confidence": "Improve document quality or lighting for better text recognition",
            "blurry_image": "Retake photo with better focus and lighting",
            "contains_faces": "Redact or remove faces from evidence",
            "suspicious_device": "Verify device authenticity and security status",
            "high_ocr_confidence": "Document text quality is excellent",
        }

        for factor in factors:
            if factor in factor_recommendations:
                recommendations.append(factor_recommendations[factor])

        return recommendations

    def _generate_recommendations(
        self,
        evidence_type: EvidenceType,
        confidence_result: ConfidenceScoreResult,
        ocr_result: Optional[OCRResult],
        vision_result: Optional[VisionResult],
    ) -> list:
        recommendations = confidence_result.recommendations.copy()

        if evidence_type == EvidenceType.DOCUMENT:
            if ocr_result and ocr_result.confidence < 0.75:
                recommendations.append("Consider re-scanning document at higher resolution")

        elif evidence_type == EvidenceType.PHOTO:
            if vision_result and vision_result.image_quality < 0.7:
                recommendations.append("Image quality is below optimal - retake with better lighting")

        if confidence_result.verification_status == VerificationStatus.FLAGGED:
            recommendations.append("Manual review recommended before acceptance")

        return recommendations

    async def _fetch_file(self, file_url: str, file_key: Optional[str]) -> bytes:
        # In production, would fetch from S3 using file_key or file_url
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url, timeout=30)
                response.raise_for_status()
                return response.content
        except Exception as e:
            logger.error(f"Failed to fetch file: {e}")
            raise


verification_service = VerificationService()
