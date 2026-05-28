import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PolicyService } from '../services/policy.service';
import { RuleEngineService, EvaluationContext } from '../services/rule-engine.service';
import { ViolationService } from '../services/violation.service';
import { CertificationService } from '../services/certification.service';

@ApiTags('Compliance')
@Controller('compliance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComplianceController {
  constructor(
    private policyService: PolicyService,
    private ruleEngineService: RuleEngineService,
    private violationService: ViolationService,
    private certificationService: CertificationService,
  ) {}

  // Policy Endpoints
  @Post('policies')
  async createPolicy(@Body() data: any) {
    return this.policyService.createPolicy({
      organizationId: 'current-org-id',
      ...data,
    });
  }

  @Get('policies')
  async listPolicies(@Query() query: any) {
    return this.policyService.listPolicies('current-org-id', query);
  }

  @Get('policies/:id')
  async getPolicy(@Param('id') id: string) {
    return this.policyService.getPolicy(id, 'current-org-id');
  }

  @Put('policies/:id')
  async updatePolicy(@Param('id') id: string, @Body() data: any) {
    return this.policyService.updatePolicy(id, 'current-org-id', data);
  }

  @Post('policies/:id/publish')
  async publishPolicy(@Param('id') id: string) {
    return this.policyService.publishPolicy(id, 'current-org-id', 'current-user-id');
  }

  @Post('policies/:id/archive')
  async archivePolicy(@Param('id') id: string) {
    return this.policyService.archivePolicy(id, 'current-org-id');
  }

  @Post('policies/:id/version')
  async createPolicyVersion(@Param('id') id: string) {
    return this.policyService.createPolicyVersion(id, 'current-org-id', 'current-user-id');
  }

  // Rule Endpoints
  @Post('rules')
  async createRule(@Body() data: any) {
    return this.ruleEngineService.createCustomRule({
      organizationId: 'current-org-id',
      ...data,
    });
  }

  @Get('rules/:id/statistics')
  async getRuleStats(@Param('id') id: string) {
    return this.ruleEngineService.getRuleStatistics(id);
  }

  @Put('rules/:id/toggle')
  async toggleRule(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.ruleEngineService.toggleRule(id, enabled);
  }

  @Post('evaluate')
  async evaluatePolicy(@Body() data: any) {
    const context: EvaluationContext = {
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      data: data.data,
      metadata: data.metadata,
    };

    return this.ruleEngineService.evaluatePolicy(
      data.policyId,
      'current-org-id',
      context,
    );
  }

  // Violation Endpoints
  @Get('violations')
  async listViolations(@Query() query: any) {
    return this.violationService.listViolations('current-org-id', query);
  }

  @Get('violations/:id')
  async getViolation(@Param('id') id: string) {
    return this.violationService.getViolation(id, 'current-org-id');
  }

  @Post('violations/:id/acknowledge')
  async acknowledgeViolation(@Param('id') id: string) {
    return this.violationService.acknowledgeViolation(
      id,
      'current-org-id',
      'current-user-id',
    );
  }

  @Post('violations/:id/resolve')
  async resolveViolation(@Param('id') id: string, @Body() data: any) {
    return this.violationService.resolveViolation(id, 'current-org-id', {
      ...data,
      resolvedBy: 'current-user-id',
    });
  }

  @Post('violations/:id/escalate')
  async escalateViolation(
    @Param('id') id: string,
    @Body('level') level: number,
  ) {
    return this.violationService.escalateViolation(id, 'current-org-id', level);
  }

  @Get('violations/resource/:resourceType/:resourceId')
  async getResourceViolations(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.violationService.getViolationsByResource(
      'current-org-id',
      resourceType,
      resourceId,
    );
  }

  @Get('violations/critical')
  async getCriticalViolations() {
    return this.violationService.getCriticalViolations('current-org-id');
  }

  @Get('violations/stats')
  async getViolationStats() {
    return this.violationService.getViolationStats('current-org-id');
  }

  // Certification Endpoints
  @Post('certifications')
  async createCertification(@Body() data: any) {
    return this.certificationService.createCertification({
      organizationId: 'current-org-id',
      ...data,
    });
  }

  @Get('certifications')
  async listCertifications(@Query() query: any) {
    return this.certificationService.listCertifications('current-org-id', query);
  }

  @Get('certifications/:id')
  async getCertification(@Param('id') id: string) {
    return this.certificationService.getCertification(id, 'current-org-id');
  }

  @Put('certifications/:id/progress')
  async updateProgress(@Param('id') id: string, @Body() data: any) {
    return this.certificationService.updateComplianceProgress(
      id,
      'current-org-id',
      data,
    );
  }

  @Post('certifications/:id/certify')
  async certify(@Param('id') id: string, @Body() data: any) {
    return this.certificationService.certify(id, 'current-org-id', data);
  }

  @Post('certifications/:id/renew')
  async renewCertification(
    @Param('id') id: string,
    @Body('newExpiryDate') newExpiryDate: Date,
  ) {
    return this.certificationService.renewCertification(
      id,
      'current-org-id',
      newExpiryDate,
    );
  }

  @Post('certifications/:id/revoke')
  async revokeCertification(@Param('id') id: string) {
    return this.certificationService.revokeCertification(id, 'current-org-id');
  }

  @Get('certifications/active')
  async getActiveCertifications() {
    return this.certificationService.getActiveCertifications('current-org-id');
  }

  @Get('certifications/status')
  async getCertificationStatus() {
    return this.certificationService.getCertificationStatus('current-org-id');
  }
}
