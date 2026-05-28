import os
from typing import Optional


class Config:
    SERVICE_NAME = "confidence-ai-services"
    SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", 3001))
    SERVICE_HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")

    JAEGER_ENABLED = os.getenv("JAEGER_ENABLED", "true").lower() == "true"
    JAEGER_AGENT_HOST = os.getenv("JAEGER_AGENT_HOST", "localhost")
    JAEGER_AGENT_PORT = int(os.getenv("JAEGER_AGENT_PORT", 6831))

    OCR_CONFIDENCE_THRESHOLD = float(os.getenv("OCR_CONFIDENCE_THRESHOLD", 0.7))
    VISION_CONFIDENCE_THRESHOLD = float(os.getenv("VISION_CONFIDENCE_THRESHOLD", 0.8))

    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 50 * 1024 * 1024))  # 50MB
    ALLOWED_MIME_TYPES = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "video/mp4",
    ]

    ANOMALY_DETECTION_SENSITIVITY = float(os.getenv("ANOMALY_DETECTION_SENSITIVITY", 0.7))
    ANOMALY_DETECTION_WINDOW_SIZE = int(os.getenv("ANOMALY_DETECTION_WINDOW_SIZE", 100))


config = Config()
