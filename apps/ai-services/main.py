import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from shared.config import config
from shared.models import (
    VerificationRequest,
    VerificationResponse,
    HealthCheckResponse,
)
from ocr.service import ocr_service
from vision.service import vision_service
from verification.service import verification_service
from anomaly.service import anomaly_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Track uptime
start_time = time.time()


# Initialize observability
def init_observability():
    if config.JAEGER_ENABLED:
        try:
            from opentelemetry import trace
            from opentelemetry.exporter.jaeger.thrift import JaegerExporter
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
            from opentelemetry.instrumentation.requests import RequestsInstrumentor

            jaeger_exporter = JaegerExporter(
                agent_host_name=config.JAEGER_AGENT_HOST,
                agent_port=config.JAEGER_AGENT_PORT,
            )

            trace.set_tracer_provider(TracerProvider())
            trace.get_tracer_provider().add_span_processor(
                BatchSpanProcessor(jaeger_exporter)
            )

            FastAPIInstrumentor.instrument_app(app)
            RequestsInstrumentor().instrument()

            logger.info("Jaeger observability initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Jaeger: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_observability()
    logger.info("AI Verification Services started")
    yield
    logger.info("AI Verification Services shutting down")


app = FastAPI(
    title="Confidence Systems - AI Verification Services",
    description="OCR, computer vision, and verification microservices",
    version="1.0.0",
    lifespan=lifespan,
)


# Health check endpoint
@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    return HealthCheckResponse(
        status="healthy",
        service="ai-verification",
        version="1.0.0",
        uptime_seconds=time.time() - start_time,
    )


# OCR endpoints
@app.post("/ocr/extract")
async def extract_text(
    file: UploadFile = File(...),
    language: str = "eng",
    preprocess: bool = True,
):
    try:
        if file.size and file.size > config.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")

        if file.content_type not in config.ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        content = await file.read()
        result = await ocr_service.extract_text(content, language, preprocess)

        return {
            "status": "success",
            "data": result.model_dump(),
        }

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        raise HTTPException(status_code=500, detail="OCR processing failed")


@app.post("/ocr/extract-structured")
async def extract_structured_text(file: UploadFile = File(...)):
    try:
        if file.size and file.size > config.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")

        content = await file.read()
        result = await ocr_service.extract_structured(content)

        return {
            "status": "success",
            "data": result,
        }

    except Exception as e:
        logger.error(f"Structured extraction failed: {e}")
        raise HTTPException(status_code=500, detail="Structured extraction failed")


# Vision endpoints
@app.post("/vision/detect-objects")
async def detect_objects(file: UploadFile = File(...)):
    try:
        if file.size and file.size > config.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")

        content = await file.read()
        result = await vision_service.detect_objects(content)

        return {
            "status": "success",
            "data": result.model_dump(),
        }

    except Exception as e:
        logger.error(f"Object detection failed: {e}")
        raise HTTPException(status_code=500, detail="Object detection failed")


@app.post("/vision/detect-ppe")
async def detect_ppe(file: UploadFile = File(...)):
    try:
        if file.size and file.size > config.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")

        content = await file.read()
        result = await vision_service.detect_ppe(content)

        return {
            "status": "success",
            "data": result.model_dump(),
        }

    except Exception as e:
        logger.error(f"PPE detection failed: {e}")
        raise HTTPException(status_code=500, detail="PPE detection failed")


@app.post("/vision/assess-document-quality")
async def assess_document_quality(file: UploadFile = File(...)):
    try:
        if file.size and file.size > config.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")

        content = await file.read()
        result = await vision_service.assess_document_quality(content)

        return {
            "status": "success",
            "data": result,
        }

    except Exception as e:
        logger.error(f"Quality assessment failed: {e}")
        raise HTTPException(status_code=500, detail="Quality assessment failed")


# Verification endpoint
@app.post("/verify", response_model=dict)
async def verify_evidence(request: VerificationRequest):
    try:
        result = await verification_service.verify_evidence(request)

        return {
            "status": "success",
            "data": result.model_dump(),
        }

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Evidence verification failed: {e}")
        raise HTTPException(status_code=500, detail="Verification failed")


# Anomaly detection endpoint
@app.post("/anomaly/detect")
async def detect_anomaly(request):
    try:
        from shared.models import AnomalyDetectionRequest
        anomaly_request = AnomalyDetectionRequest(**request.dict())
        result = await anomaly_service.detect_anomaly(anomaly_request)

        return {
            "status": "success",
            "data": result.model_dump(),
        }

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Anomaly detection failed: {e}")
        raise HTTPException(status_code=500, detail="Anomaly detection failed")


# Status endpoint
@app.get("/status")
async def service_status():
    return {
        "status": "operational",
        "services": {
            "ocr": "ready",
            "vision": "ready",
            "verification": "ready",
            "anomaly_detection": "ready",
        },
        "uptime_seconds": time.time() - start_time,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=config.SERVICE_HOST,
        port=config.SERVICE_PORT,
        log_level="info",
    )
