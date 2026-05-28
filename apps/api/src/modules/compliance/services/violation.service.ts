import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Violation, ViolationStatus } from '../entities/violation.entity';
import { LoggerService } from '@observability/logger.service';

@Injectable()
export class ViolationService {
  constructor(
    @InjectRepository(Violation)
    private violationRepository: Repository<Violation>,
    private logger: LoggerService,
  ) {}

  async getViolation(
    violationId: string,
    organizationId: string,
  ): Promise<Violation> {
    const violation = await this.violationRepository.findOne({
      where: { id: violationId, organizationId },
      relations: ['policy', 'rule'],
    });

    if (!violation) {
      throw new NotFoundException('Violation not found');
    }

    return violation;
  }

  async listViolations(
    organizationId: string,
    filters?: {
      status?: ViolationStatus;
      severity?: string;
      policyId?: string;
      ruleId?: string;
      resourceType?: string;
      resourceId?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query = this.violationRepository
      .createQueryBuilder('v')
      .where('v.organizationId = :organizationId', { organizationId })
      .leftJoinAndSelect('v.policy', 'policy')
      .leftJoinAndSelect('v.rule', 'rule');

    if (filters?.status) {
      query.andWhere('v.status = :status', { status: filters.status });
    }

    if (filters?.severity) {
      query.andWhere('v.severity = :severity', { severity: filters.severity });
    }

    if (filters?.policyId) {
      query.andWhere('v.policyId = :policyId', { policyId: filters.policyId });
    }

    if (filters?.ruleId) {
      query.andWhere('v.ruleId = :ruleId', { ruleId: filters.ruleId });
    }

    if (filters?.resourceType) {
      query.andWhere('v.resourceType = :resourceType', {
        resourceType: filters.resourceType,
      });
    }

    if (filters?.resourceId) {
      query.andWhere('v.resourceId = :resourceId', { resourceId: filters.resourceId });
    }

    query.orderBy('v.createdAt', 'DESC');

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [violations, total] = await query
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { violations, total, limit, offset };
  }

  async acknowledgeViolation(
    violationId: string,
    organizationId: string,
    acknowledgedBy: string,
  ): Promise<Violation> {
    const violation = await this.getViolation(violationId, organizationId);

    await this.violationRepository.update(
      { id: violationId },
      {
        status: 'acknowledged',
        acknowledgedBy,
        acknowledgedAt: new Date(),
      },
    );

    this.logger.log(
      `Violation acknowledged: ${violationId}`,
      'ViolationService',
    );

    return this.getViolation(violationId, organizationId);
  }

  async resolveViolation(
    violationId: string,
    organizationId: string,
    data: {
      status: ViolationStatus;
      resolvedBy: string;
      notes?: string;
      remediationAction?: string;
    },
  ): Promise<Violation> {
    const violation = await this.getViolation(violationId, organizationId);

    await this.violationRepository.update(
      { id: violationId },
      {
        status: data.status,
        resolvedBy: data.resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: data.notes,
        remediationAction: data.remediationAction,
      },
    );

    this.logger.log(
      `Violation resolved: ${violationId} (Status: ${data.status})`,
      'ViolationService',
    );

    return this.getViolation(violationId, organizationId);
  }

  async escalateViolation(
    violationId: string,
    organizationId: string,
    level: number = 1,
  ): Promise<Violation> {
    const violation = await this.getViolation(violationId, organizationId);

    await this.violationRepository.update(
      { id: violationId },
      { escalationLevel: Math.min(level, 3) },
    );

    this.logger.log(
      `Violation escalated: ${violationId} (Level: ${level})`,
      'ViolationService',
    );

    return this.getViolation(violationId, organizationId);
  }

  async getViolationsByResource(
    organizationId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<Violation[]> {
    return this.violationRepository.find({
      where: { organizationId, resourceType, resourceId },
      order: { createdAt: 'DESC' },
      relations: ['policy', 'rule'],
    });
  }

  async getOpenViolations(organizationId: string): Promise<Violation[]> {
    return this.violationRepository.find({
      where: { organizationId, status: 'open' },
      order: { createdAt: 'ASC' },
      relations: ['policy', 'rule'],
    });
  }

  async getCriticalViolations(organizationId: string): Promise<Violation[]> {
    return this.violationRepository
      .createQueryBuilder('v')
      .where('v.organizationId = :organizationId', { organizationId })
      .andWhere('v.severity = :severity', { severity: 'critical' })
      .andWhere('v.status IN (:...statuses)', { statuses: ['open', 'acknowledged'] })
      .leftJoinAndSelect('v.policy', 'policy')
      .leftJoinAndSelect('v.rule', 'rule')
      .orderBy('v.createdAt', 'ASC')
      .getMany();
  }

  async getViolationStats(organizationId: string) {
    const total = await this.violationRepository.count({
      where: { organizationId },
    });

    const byStatus = await this.violationRepository.query(
      `SELECT status, COUNT(*) as count FROM compliance.violations
       WHERE "organizationId" = $1
       GROUP BY status`,
      [organizationId],
    );

    const bySeverity = await this.violationRepository.query(
      `SELECT severity, COUNT(*) as count FROM compliance.violations
       WHERE "organizationId" = $1
       GROUP BY severity`,
      [organizationId],
    );

    const critical = await this.violationRepository.count({
      where: {
        organizationId,
        severity: 'critical',
      },
    });

    const open = await this.violationRepository.count({
      where: {
        organizationId,
        status: 'open',
      },
    });

    const overdue = await this.violationRepository.query(
      `SELECT COUNT(*) FROM compliance.violations
       WHERE "organizationId" = $1
       AND status IN ('open', 'acknowledged')
       AND EXTRACT(DAY FROM NOW() - "createdAt") > 30`,
      [organizationId],
    );

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, parseInt(s.count, 10)])),
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, parseInt(s.count, 10)])),
      critical,
      open,
      overdue: parseInt(overdue[0].count, 10),
      complianceScore: Math.max(0, 100 - (open / total) * 100),
    };
  }
}
