# Confidence Systems - AI Verification Services

Python microservices for evidence verification, combining OCR, computer vision, confidence scoring, and anomaly detection.

## Services

### OCR Service
- Document text extraction with confidence scoring
- Support for multiple languages (via pytesseract)
- Image preprocessing and quality assessment
- Structured text extraction with bounding boxes

**Endpoints:**
- `POST /ocr/extract` - Extract text from image
- `POST /ocr/extract-structured` - Extract text with positions

### Vision Service
- Object detection (PPE, equipment, safety signs)
- Face detection
- Image quality assessment
- Blur detection
- Brightness and contrast analysis

**Endpoints:**
- `POST /vision/detect-objects` - Detect objects in image
- `POST /vision/detect-ppe` - Detect personal protective equipment
- `POST /vision/assess-document-quality` - Assess document image quality

### Verification Service
- Combines OCR and vision results
- Confidence scoring with weighted components
- Multi-factor verification status determination
- Recommendation generation

**Endpoints:**
- `POST /verify` - Complete evidence verification

### Anomaly Detection Service
- Statistical anomaly detection (z-score based)
- Metadata-based anomaly detection
- Pattern-based anomaly detection
- Similar case finding

**Endpoints:**
- `POST /anomaly/detect` - Detect anomalies in evidence

## Development Setup

### Prerequisites
- Python 3.11+
- Tesseract OCR: `brew install tesseract` (macOS) or `apt-get install tesseract-ocr` (Linux)

### Installation

```bash
cd apps/ai-services
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Local Development

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

Visit http://localhost:3001/docs for API documentation.

### Docker Setup

Build and run with docker-compose:

```bash
docker-compose up ai-services
```

## Configuration

Environment variables:

```
AI_SERVICE_PORT=3001
AI_SERVICE_HOST=0.0.0.0
JAEGER_ENABLED=true
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=6831
OCR_CONFIDENCE_THRESHOLD=0.7
VISION_CONFIDENCE_THRESHOLD=0.8
MAX_FILE_SIZE=52428800
```

## API Examples

### Extract Text (OCR)

```bash
curl -X POST "http://localhost:3001/ocr/extract" \
  -F "file=@document.pdf" \
  -F "language=eng" \
  -F "preprocess=true"
```

### Detect Objects

```bash
curl -X POST "http://localhost:3001/vision/detect-objects" \
  -F "file=@image.jpg"
```

### Complete Verification

```bash
curl -X POST "http://localhost:3001/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_id": "uuid",
    "evidence_type": "photo",
    "file_url": "https://...",
    "metadata": {...}
  }'
```

## Integration with Main API

The main NestJS API integrates via `AIVerificationService`:

```typescript
const result = await aiVerificationService.verifyEvidence(evidence);
```

Results are stored back to the Evidence entity with verification status and confidence score.

## Performance

- OCR: ~500ms-2s per document (depends on size and quality)
- Object Detection: ~200-500ms per image
- Anomaly Detection: ~50-100ms per check
- Full Verification Pipeline: ~1-3s per evidence

## Scaling Considerations

- Run multiple instances behind load balancer
- Implement request queuing for high throughput
- Cache model weights in GPU memory
- Use async processing for large batches

## Observability

- Jaeger tracing: http://localhost:16686
- Metrics exposed at Prometheus format
- Structured logging with context tracking
