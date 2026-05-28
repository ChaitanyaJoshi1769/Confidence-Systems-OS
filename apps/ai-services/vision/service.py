import io
import logging
from typing import List, Dict, Any, Tuple
import cv2
import numpy as np
from PIL import Image
from shared.models import VisionResult, VisionDetection
from shared.config import config

logger = logging.getLogger(__name__)


class VisionService:
    def __init__(self):
        self.confidence_threshold = config.VISION_CONFIDENCE_THRESHOLD
        self.detection_classes = {
            "PPE": ["helmet", "safety_vest", "safety_glasses", "gloves"],
            "Equipment": ["vehicle", "machinery", "tool", "crane"],
            "Safety": ["fire_extinguisher", "first_aid", "exit_sign"],
            "Compliance": ["warning_sign", "caution_sign", "permit"],
        }

    async def detect_objects(
        self, image_data: bytes
    ) -> VisionResult:
        try:
            image = Image.open(io.BytesIO(image_data))
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            detections = await self._perform_detection(cv_image)
            quality_score = self._assess_image_quality(cv_image)
            has_faces, face_count = await self._detect_faces(cv_image)
            is_blurry = self._detect_blur(cv_image)

            overall_confidence = (
                sum(d.confidence for d in detections) / len(detections)
                if detections
                else 0.0
            )

            return VisionResult(
                detections=detections,
                overall_confidence=min(overall_confidence, 1.0),
                image_quality=quality_score,
                is_blurry=is_blurry,
                has_faces=has_faces,
                face_count=face_count,
                metadata={
                    "image_shape": cv_image.shape,
                    "detection_count": len(detections),
                    "processed_at": str(np.datetime64("now")),
                },
            )

        except Exception as e:
            logger.error(f"Object detection failed: {e}")
            raise

    async def detect_ppe(self, image_data: bytes) -> VisionResult:
        """Detect personal protective equipment in images"""
        try:
            image = Image.open(io.BytesIO(image_data))
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            ppe_detections = []

            # Simulate PPE detection (in production use YOLOv8/similar)
            for ppe_type in self.detection_classes["PPE"]:
                confidence = np.random.uniform(0.6, 0.95)
                if confidence >= self.confidence_threshold:
                    bbox = {
                        "left": np.random.randint(0, 100),
                        "top": np.random.randint(0, 100),
                        "width": np.random.randint(50, 150),
                        "height": np.random.randint(50, 150),
                    }
                    ppe_detections.append(
                        VisionDetection(
                            class_name=ppe_type,
                            confidence=confidence,
                            bounding_box=bbox,
                            metadata={"ppe_type": ppe_type},
                        )
                    )

            return VisionResult(
                detections=ppe_detections,
                overall_confidence=(
                    sum(d.confidence for d in ppe_detections) / len(ppe_detections)
                    if ppe_detections
                    else 0.0
                ),
                image_quality=self._assess_image_quality(cv_image),
                is_blurry=self._detect_blur(cv_image),
                has_faces=False,
                face_count=0,
                metadata={"detection_type": "ppe"},
            )

        except Exception as e:
            logger.error(f"PPE detection failed: {e}")
            raise

    async def assess_document_quality(self, image_data: bytes) -> Dict[str, Any]:
        """Assess document image quality for OCR"""
        try:
            image = Image.open(io.BytesIO(image_data))
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            quality_metrics = {
                "sharpness": self._measure_sharpness(cv_image),
                "brightness": self._measure_brightness(cv_image),
                "contrast": self._measure_contrast(cv_image),
                "noise_level": self._estimate_noise(cv_image),
                "is_blurry": self._detect_blur(cv_image),
                "overall_quality": 0.0,
            }

            # Calculate overall quality (0-1 scale)
            quality_metrics["overall_quality"] = (
                quality_metrics["sharpness"] * 0.4
                + (1 - quality_metrics["noise_level"]) * 0.2
                + min(quality_metrics["brightness"] / 255, 1.0) * 0.2
                + min(quality_metrics["contrast"] / 100, 1.0) * 0.2
            )

            return quality_metrics

        except Exception as e:
            logger.error(f"Document quality assessment failed: {e}")
            raise

    async def _perform_detection(self, cv_image) -> List[VisionDetection]:
        detections = []
        for category, classes in self.detection_classes.items():
            for class_name in classes:
                confidence = np.random.uniform(0.5, 0.95)
                if confidence >= self.confidence_threshold:
                    detections.append(
                        VisionDetection(
                            class_name=class_name,
                            confidence=confidence,
                            bounding_box={
                                "left": np.random.randint(0, 100),
                                "top": np.random.randint(0, 100),
                                "width": np.random.randint(50, 150),
                                "height": np.random.randint(50, 150),
                            },
                            metadata={"category": category},
                        )
                    )
        return detections

    async def _detect_faces(self, cv_image) -> Tuple[bool, int]:
        try:
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            has_faces = len(faces) > 0
            return has_faces, len(faces)
        except Exception as e:
            logger.warning(f"Face detection failed: {e}")
            return False, 0

    def _measure_sharpness(self, cv_image) -> float:
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        sharpness = min(laplacian_var / 500, 1.0)
        return sharpness

    def _measure_brightness(self, cv_image) -> float:
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)
        return brightness

    def _measure_contrast(self, cv_image) -> float:
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        contrast = np.std(gray)
        return contrast

    def _estimate_noise(self, cv_image) -> float:
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        noise_estimate = np.std(laplacian)
        normalized_noise = min(noise_estimate / 50, 1.0)
        return normalized_noise

    def _detect_blur(self, cv_image) -> bool:
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur_threshold = 100
        return laplacian_var < blur_threshold

    def _assess_image_quality(self, cv_image) -> float:
        sharpness = self._measure_sharpness(cv_image)
        brightness = min(self._measure_brightness(cv_image) / 255, 1.0)
        contrast = min(self._measure_contrast(cv_image) / 100, 1.0)
        noise = 1 - min(self._estimate_noise(cv_image), 1.0)

        quality = (sharpness * 0.4 + brightness * 0.2 +
                   contrast * 0.2 + noise * 0.2)
        return min(quality, 1.0)


vision_service = VisionService()
