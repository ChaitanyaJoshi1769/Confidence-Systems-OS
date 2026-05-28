import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AIVerificationService } from '../services/ai-verification.service';
import { EvidenceService } from '../../evidence/services/evidence.service';

@ApiTags('AI Verification')
@Controller('ai/verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIVerificationController {
  constructor(
    private aiVerificationService: AIVerificationService,
    private evidenceService: EvidenceService,
  ) {}

  @Post('verify/:evidenceId')
  async verifyEvidence(@Param('evidenceId') evidenceId: string) {
    const evidence = await this.evidenceService.getEvidence(evidenceId, 'current-org-id');
    const result = await this.aiVerificationService.verifyEvidence(evidence);

    // Store verification results
    await this.evidenceService.updateAIVerification(evidenceId, {
      status: result.status as any,
      confidenceScore: result.confidence_score,
      metadata: result.metadata,
      verifiedBy: 'ai_verification_service',
    });

    return result;
  }

  @Post('ocr')
  async extractText(
    @Query('fileUrl') fileUrl: string,
    @Query('language') language: string = 'eng',
  ) {
    return this.aiVerificationService.extractOCR(fileUrl, language);
  }

  @Post('vision/detect-objects')
  async detectObjects(@Query('fileUrl') fileUrl: string) {
    return this.aiVerificationService.detectObjects(fileUrl);
  }

  @Post('vision/detect-ppe')
  async detectPPE(@Query('fileUrl') fileUrl: string) {
    return this.aiVerificationService.detectPPE(fileUrl);
  }

  @Post('vision/assess-quality')
  async assessQuality(@Query('fileUrl') fileUrl: string) {
    return this.aiVerificationService.assessDocumentQuality(fileUrl);
  }

  @Get('status')
  async getStatus() {
    return this.aiVerificationService.getServiceStatus();
  }
}
