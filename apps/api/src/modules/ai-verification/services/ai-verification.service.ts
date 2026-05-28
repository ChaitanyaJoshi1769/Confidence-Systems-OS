import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Evidence } from '../../evidence/entities/evidence.entity';

interface VerificationRequest {
  evidence_id: string;
  evidence_type: string;
  file_url: string;
  file_key?: string;
  metadata: Record<string, any>;
  device_info?: Record<string, any>;
  location_info?: Record<string, any>;
}

interface VerificationResponse {
  evidence_id: string;
  status: 'pending' | 'verified' | 'flagged' | 'needs_review';
  confidence_score: number;
  ocr_result?: any;
  vision_result?: any;
  anomaly_result?: any;
  recommendations: string[];
  verified_at: string;
  metadata: Record<string, any>;
}

@Injectable()
export class AIVerificationService {
  private readonly aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
  private readonly timeout = 30000; // 30 seconds

  constructor(private httpService: HttpService) {}

  async verifyEvidence(evidence: Evidence): Promise<VerificationResponse> {
    if (!evidence.fileUrl && !evidence.fileKey) {
      throw new BadRequestException('Evidence must have fileUrl or fileKey');
    }

    const verificationRequest: VerificationRequest = {
      evidence_id: evidence.id,
      evidence_type: evidence.evidenceType,
      file_url: evidence.fileUrl || '',
      file_key: evidence.fileKey,
      metadata: evidence.metadata || {},
      device_info: {
        deviceId: evidence.deviceId,
        deviceName: evidence.deviceName,
        deviceOs: evidence.deviceOs,
        deviceIp: evidence.deviceIp,
      },
      location_info: {
        latitude: evidence.latitude,
        longitude: evidence.longitude,
        accuracy: evidence.locationAccuracy,
        timestamp: evidence.locationTimestamp,
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ status: string; data: VerificationResponse }>(
          `${this.aiServiceUrl}/verify`,
          verificationRequest,
          { timeout: this.timeout },
        ),
      );

      if (response.data.status !== 'success') {
        throw new ServiceUnavailableException('AI verification service returned error');
      }

      return response.data.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('AI verification service is unavailable');
    }
  }

  async extractOCR(fileUrl: string, language: string = 'eng') {
    try {
      const formData = new FormData();
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      formData.append('file', blob);
      formData.append('language', language);

      const result = await firstValueFrom(
        this.httpService.post<any>(
          `${this.aiServiceUrl}/ocr/extract`,
          formData,
          {
            timeout: this.timeout,
            headers: formData.getHeaders?.(),
          },
        ),
      );

      return result.data.data;
    } catch (error) {
      throw new ServiceUnavailableException('OCR service is unavailable');
    }
  }

  async detectObjects(fileUrl: string) {
    try {
      const formData = new FormData();
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      formData.append('file', blob);

      const result = await firstValueFrom(
        this.httpService.post<any>(
          `${this.aiServiceUrl}/vision/detect-objects`,
          formData,
          {
            timeout: this.timeout,
            headers: formData.getHeaders?.(),
          },
        ),
      );

      return result.data.data;
    } catch (error) {
      throw new ServiceUnavailableException('Vision service is unavailable');
    }
  }

  async detectPPE(fileUrl: string) {
    try {
      const formData = new FormData();
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      formData.append('file', blob);

      const result = await firstValueFrom(
        this.httpService.post<any>(
          `${this.aiServiceUrl}/vision/detect-ppe`,
          formData,
          {
            timeout: this.timeout,
            headers: formData.getHeaders?.(),
          },
        ),
      );

      return result.data.data;
    } catch (error) {
      throw new ServiceUnavailableException('Vision service is unavailable');
    }
  }

  async assessDocumentQuality(fileUrl: string) {
    try {
      const formData = new FormData();
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      formData.append('file', blob);

      const result = await firstValueFrom(
        this.httpService.post<any>(
          `${this.aiServiceUrl}/vision/assess-document-quality`,
          formData,
          {
            timeout: this.timeout,
            headers: formData.getHeaders?.(),
          },
        ),
      );

      return result.data.data;
    } catch (error) {
      throw new ServiceUnavailableException('Vision service is unavailable');
    }
  }

  async getServiceStatus() {
    try {
      const result = await firstValueFrom(
        this.httpService.get<any>(
          `${this.aiServiceUrl}/status`,
          { timeout: 5000 },
        ),
      );

      return result.data;
    } catch (error) {
      throw new ServiceUnavailableException('AI services are unavailable');
    }
  }
}
