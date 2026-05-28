import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np
from sklearn.ensemble import IsolationForest
from shared.models import (
    AnomalyDetectionRequest,
    AnomalyDetectionResult,
    EvidenceType,
)
from shared.config import config

logger = logging.getLogger(__name__)


class AnomalyDetectionService:
    def __init__(self):
        self.sensitivity = config.ANOMALY_DETECTION_SENSITIVITY
        self.window_size = config.ANOMALY_DETECTION_WINDOW_SIZE
        self.models = {}  # Store models per evidence type
        self._initialize_models()

    def _initialize_models(self):
        for evidence_type in EvidenceType:
            self.models[evidence_type.value] = IsolationForest(
                contamination=0.1,
                random_state=42,
                n_estimators=100,
            )

    async def detect_anomaly(
        self,
        request: AnomalyDetectionRequest,
    ) -> AnomalyDetectionResult:
        try:
            logger.info(f"Starting anomaly detection for {request.evidence_id}")

            anomaly_reasons = []
            anomaly_score = 0.0

            # Statistical anomaly detection
            stat_anomaly = self._detect_statistical_anomaly(
                request.confidence_score,
                request.historical_data or [],
            )

            if stat_anomaly["is_anomalous"]:
                anomaly_reasons.append(stat_anomaly["reason"])
                anomaly_score = max(anomaly_score, stat_anomaly["score"])

            # Metadata-based anomaly detection
            metadata_anomaly = await self._detect_metadata_anomaly(
                request.metadata,
                request.evidence_type,
            )

            if metadata_anomaly["is_anomalous"]:
                anomaly_reasons.extend(metadata_anomaly["reasons"])
                anomaly_score = max(anomaly_score, metadata_anomaly["score"])

            # Pattern-based anomaly detection
            if request.historical_data:
                pattern_anomaly = self._detect_pattern_anomaly(
                    request.evidence_id,
                    request.metadata,
                    request.historical_data,
                )

                if pattern_anomaly["is_anomalous"]:
                    anomaly_reasons.extend(pattern_anomaly["reasons"])
                    anomaly_score = max(anomaly_score, pattern_anomaly["score"])

            # Determine if overall anomalous
            is_anomalous = anomaly_score >= self.sensitivity
            confidence = min(anomaly_score, 1.0)

            recommendations = self._generate_recommendations(
                is_anomalous,
                anomaly_reasons,
            )

            similar_cases = await self._find_similar_anomalies(
                request.evidence_type,
                request.metadata,
            )

            return AnomalyDetectionResult(
                is_anomalous=is_anomalous,
                anomaly_score=anomaly_score,
                confidence=confidence,
                anomaly_reasons=anomaly_reasons,
                similar_cases=similar_cases,
                recommendations=recommendations,
                metadata={
                    "detection_timestamp": datetime.utcnow().isoformat(),
                    "detection_methods": [
                        "statistical",
                        "metadata",
                        "pattern",
                    ],
                },
            )

        except Exception as e:
            logger.error(f"Anomaly detection failed for {request.evidence_id}: {e}")
            raise

    def _detect_statistical_anomaly(
        self,
        current_score: float,
        historical_data: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not historical_data or len(historical_data) < 5:
            return {"is_anomalous": False, "reason": "", "score": 0.0}

        try:
            scores = [d.get("confidence_score", 0.5) for d in historical_data]
            mean = np.mean(scores)
            std = np.std(scores)

            if std == 0:
                return {"is_anomalous": False, "reason": "", "score": 0.0}

            z_score = abs((current_score - mean) / std)

            # Anomalous if z-score > 2.5 (99.4% confidence)
            is_anomalous = z_score > 2.5
            anomaly_score = min(z_score / 4.0, 1.0)

            reason = (
                f"Confidence score {current_score:.2f} is {z_score:.1f} "
                f"standard deviations from mean {mean:.2f}"
            )

            return {
                "is_anomalous": is_anomalous,
                "reason": reason,
                "score": anomaly_score,
                "z_score": z_score,
            }

        except Exception as e:
            logger.warning(f"Statistical anomaly detection failed: {e}")
            return {"is_anomalous": False, "reason": "", "score": 0.0}

    async def _detect_metadata_anomaly(
        self,
        metadata: Dict[str, Any],
        evidence_type: EvidenceType,
    ) -> Dict[str, Any]:
        reasons = []
        score = 0.0

        # Check location anomalies
        location = metadata.get("location_info", {})
        if location.get("accuracy", 100) > 1000:  # Very poor GPS accuracy
            reasons.append("GPS location accuracy unusually poor")
            score = max(score, 0.5)

        # Check device anomalies
        device = metadata.get("device_info", {})
        if device.get("is_jailbroken"):
            reasons.append("Device is jailbroken - potential tampering")
            score = max(score, 0.8)

        if device.get("is_emulator"):
            reasons.append("Evidence captured on emulator")
            score = max(score, 0.6)

        # Check timestamp anomalies
        timestamp = metadata.get("timestamp")
        if timestamp:
            from datetime import datetime as dt

            evidence_time = dt.fromisoformat(timestamp)
            time_diff = (dt.utcnow() - evidence_time).total_seconds()

            if time_diff < -300:  # 5 minutes in future
                reasons.append("Timestamp is in the future")
                score = max(score, 0.7)

            if time_diff > 86400 * 7:  # More than 7 days old
                reasons.append("Evidence is more than 7 days old")
                score = max(score, 0.4)

        return {
            "is_anomalous": len(reasons) > 0,
            "reasons": reasons,
            "score": min(score, 1.0),
        }

    def _detect_pattern_anomaly(
        self,
        evidence_id: str,
        metadata: Dict[str, Any],
        historical_data: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        reasons = []
        score = 0.0

        # Check for burst patterns
        if len(historical_data) >= 5:
            recent_evidence = historical_data[-5:]
            timestamps = [
                d.get("timestamp", "")
                for d in recent_evidence
                if d.get("timestamp")
            ]

            if len(timestamps) >= 3:
                from datetime import datetime as dt

                time_diffs = []
                for i in range(1, len(timestamps)):
                    try:
                        t1 = dt.fromisoformat(timestamps[i - 1])
                        t2 = dt.fromisoformat(timestamps[i])
                        time_diffs.append((t2 - t1).total_seconds())
                    except:
                        pass

                if time_diffs:
                    mean_diff = np.mean(time_diffs)
                    std_diff = np.std(time_diffs)

                    if std_diff > 0 and abs(time_diffs[-1] - mean_diff) > 3 * std_diff:
                        reasons.append("Unusual timing pattern detected")
                        score = max(score, 0.4)

        # Check for location patterns
        location = metadata.get("location_info", {})
        if location and historical_data:
            locations = [
                d.get("metadata", {}).get("location_info", {})
                for d in historical_data[-10:]
            ]
            valid_locations = [l for l in locations if l]

            if len(valid_locations) >= 3:
                lats = [l.get("latitude", 0) for l in valid_locations]
                lons = [l.get("longitude", 0) for l in valid_locations]

                lat_std = np.std(lats)
                lon_std = np.std(lons)

                current_lat = location.get("latitude", 0)
                current_lon = location.get("longitude", 0)

                if lat_std > 0 and abs(current_lat - np.mean(lats)) > 3 * lat_std:
                    reasons.append("Unusual geographic location")
                    score = max(score, 0.5)

        return {
            "is_anomalous": len(reasons) > 0,
            "reasons": reasons,
            "score": min(score, 1.0),
        }

    def _generate_recommendations(
        self,
        is_anomalous: bool,
        anomaly_reasons: List[str],
    ) -> List[str]:
        recommendations = []

        if not is_anomalous:
            recommendations.append("Evidence pattern is normal")
            return recommendations

        if any("jailbroken" in r for r in anomaly_reasons):
            recommendations.append("Verify device security and integrity")

        if any("location" in r.lower() for r in anomaly_reasons):
            recommendations.append("Verify geographic location authenticity")

        if any("timestamp" in r.lower() or "timing" in r.lower()
               for r in anomaly_reasons):
            recommendations.append("Verify timestamp accuracy and sequence")

        if any("emulator" in r.lower() for r in anomaly_reasons):
            recommendations.append("Capture evidence on physical device")

        recommendations.append("Manual review recommended before acceptance")

        return recommendations

    async def _find_similar_anomalies(
        self,
        evidence_type: EvidenceType,
        metadata: Dict[str, Any],
    ) -> Optional[List[str]]:
        # In production, would query historical database for similar anomaly patterns
        return None


anomaly_service = AnomalyDetectionService()
