import io
import logging
from typing import Optional, Tuple
from PIL import Image
import pytesseract
from shared.models import OCRResult
from shared.config import config

logger = logging.getLogger(__name__)


class OCRService:
    def __init__(self):
        self.confidence_threshold = config.OCR_CONFIDENCE_THRESHOLD
        self._verify_tesseract()

    def _verify_tesseract(self):
        try:
            pytesseract.get_tesseract_version()
            logger.info("Tesseract OCR engine initialized")
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")

    async def extract_text(
        self,
        image_data: bytes,
        language: str = "eng",
        preprocess: bool = True,
    ) -> OCRResult:
        try:
            image = Image.open(io.BytesIO(image_data))

            if preprocess:
                image = self._preprocess_image(image)

            # Extract text with confidence
            data = pytesseract.image_to_data(
                image,
                lang=language,
                output_type=pytesseract.Output.DICT,
            )

            text, word_confidence = self._extract_confidence(data)
            confidence = word_confidence if word_confidence > 0 else 0.0

            char_count = len(text.replace(" ", "").replace("\n", ""))
            word_count = len(text.split())

            return OCRResult(
                text=text,
                confidence=min(confidence, 1.0),
                raw_confidence=word_confidence,
                language=language,
                character_count=char_count,
                word_count=word_count,
                metadata={
                    "image_size": image.size,
                    "image_format": image.format,
                    "preprocessing_applied": preprocess,
                },
            )

        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            raise

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        # Convert to grayscale
        if image.mode != "L":
            image = image.convert("L")

        # Enhance contrast
        from PIL import ImageEnhance

        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)

        return image

    def _extract_confidence(self, data: dict) -> Tuple[str, float]:
        text_parts = []
        confidences = []

        for i in range(len(data["text"])):
            word = data["text"][i]
            conf = int(data["conf"][i])

            if word.strip():  # Skip empty words
                text_parts.append(word)
                if conf > 0:
                    confidences.append(conf / 100.0)

        text = " ".join(text_parts)
        avg_confidence = (
            sum(confidences) / len(confidences) if confidences else 0.0
        )

        return text, avg_confidence

    async def extract_structured(self, image_data: bytes) -> dict:
        """Extract structured text with bounding boxes"""
        try:
            image = Image.open(io.BytesIO(image_data))
            image = self._preprocess_image(image)

            data = pytesseract.image_to_data(
                image,
                output_type=pytesseract.Output.DICT,
            )

            structured = {
                "words": [],
                "paragraphs": [],
                "confidence": 0.0,
            }

            current_paragraph = []
            last_block = -1

            for i in range(len(data["text"])):
                if data["text"][i].strip():
                    word_data = {
                        "text": data["text"][i],
                        "confidence": int(data["conf"][i]) / 100.0,
                        "bbox": {
                            "left": int(data["left"][i]),
                            "top": int(data["top"][i]),
                            "width": int(data["width"][i]),
                            "height": int(data["height"][i]),
                        },
                    }
                    structured["words"].append(word_data)

                    if int(data["block_num"][i]) != last_block:
                        if current_paragraph:
                            structured["paragraphs"].append(
                                " ".join(current_paragraph)
                            )
                        current_paragraph = [data["text"][i]]
                        last_block = int(data["block_num"][i])
                    else:
                        current_paragraph.append(data["text"][i])

            if current_paragraph:
                structured["paragraphs"].append(" ".join(current_paragraph))

            confidences = [w["confidence"] for w in structured["words"]]
            structured["confidence"] = (
                sum(confidences) / len(confidences) if confidences else 0.0
            )

            return structured

        except Exception as e:
            logger.error(f"Structured extraction failed: {e}")
            raise


ocr_service = OCRService()
