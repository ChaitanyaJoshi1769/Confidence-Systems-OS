import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from '../entities/certification.entity';
import { LoggerService } from '@observability/logger.service';

@Injectable()
export class CertificationService {
  constructor(
    @InjectRepository(Certification)
    private certificationRepository: Repository<Certification>,
    private logger: LoggerService,
  ) {}

  async createCertification(data: {
    organizationId: string;
    certificationType: string;
    certificationName: string;
    description?: string;
    issuedAt: Date;
    expiresAt: Date;
    certificationBody?: string;
    auditReference?: string;
    requiredPoliciesCount: number;
    maintainedBy: string;
  }): Promise<Certification> {
    if (data.expiresAt <= data.issuedAt) {
      throw new BadRequestException('Expiration date must be after issued date');
    }

    const certification = await this.certificationRepository.save({
      ...data,
      status: 'in_progress',
      implementedPoliciesCount: 0,
      compliancePercentage: 0,
    });

    this.logger.log(
      `Certification created: ${certification.id} (${certification.certificationType})`,
      'CertificationService',
    );

    return certification;
  }

  async getCertification(
    certificationId: string,
    organizationId: string,
  ): Promise<Certification> {
    const certification = await this.certificationRepository.findOne({
      where: { id: certificationId, organizationId },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    return certification;
  }

  async listCertifications(
    organizationId: string,
    filters?: {
      certificationType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query = this.certificationRepository
      .createQueryBuilder('c')
      .where('c.organizationId = :organizationId', { organizationId });

    if (filters?.certificationType) {
      query.andWhere('c.certificationType = :certificationType', {
        certificationType: filters.certificationType,
      });
    }

    if (filters?.status) {
      query.andWhere('c.status = :status', { status: filters.status });
    }

    query.orderBy('c.expiresAt', 'ASC');

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [certifications, total] = await query
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { certifications, total, limit, offset };
  }

  async updateComplianceProgress(
    certificationId: string,
    organizationId: string,
    data: {
      implementedPoliciesCount?: number;
      requirementsMet?: string[];
      requirementsPending?: string[];
    },
  ): Promise<Certification> {
    const certification = await this.getCertification(
      certificationId,
      organizationId,
    );

    const implementedCount = data.implementedPoliciesCount !== undefined
      ? data.implementedPoliciesCount
      : certification.implementedPoliciesCount;

    const compliancePercentage = (implementedCount / certification.requiredPoliciesCount) * 100;

    const updates: any = {
      implementedPoliciesCount: implementedCount,
      compliancePercentage: Math.min(compliancePercentage, 100),
    };

    if (data.requirementsMet) {
      updates.requirementsMet = data.requirementsMet;
    }

    if (data.requirementsPending) {
      updates.requirementsPending = data.requirementsPending;
    }

    await this.certificationRepository.update(
      { id: certificationId },
      updates,
    );

    this.logger.log(
      `Certification progress updated: ${certificationId} (${Math.round(compliancePercentage)}%)`,
      'CertificationService',
    );

    return this.getCertification(certificationId, organizationId);
  }

  async certify(
    certificationId: string,
    organizationId: string,
    data: {
      auditFindings?: string;
      improvementAreas?: string;
    },
  ): Promise<Certification> {
    const certification = await this.getCertification(
      certificationId,
      organizationId,
    );

    if (certification.compliancePercentage < 85) {
      throw new BadRequestException(
        'Compliance percentage must be at least 85% to certify',
      );
    }

    await this.certificationRepository.update(
      { id: certificationId },
      {
        status: 'certified',
        auditFindings: data.auditFindings,
        improvementAreas: data.improvementAreas,
      },
    );

    this.logger.log(
      `Certification certified: ${certificationId}`,
      'CertificationService',
    );

    return this.getCertification(certificationId, organizationId);
  }

  async renewCertification(
    certificationId: string,
    organizationId: string,
    newExpiryDate: Date,
  ): Promise<Certification> {
    const certification = await this.getCertification(
      certificationId,
      organizationId,
    );

    if (certification.status !== 'certified') {
      throw new BadRequestException('Only certified certifications can be renewed');
    }

    await this.certificationRepository.update(
      { id: certificationId },
      {
        expiresAt: newExpiryDate,
        status: 'certified',
      },
    );

    this.logger.log(
      `Certification renewed: ${certificationId}`,
      'CertificationService',
    );

    return this.getCertification(certificationId, organizationId);
  }

  async revokeCertification(
    certificationId: string,
    organizationId: string,
  ): Promise<Certification> {
    const certification = await this.getCertification(
      certificationId,
      organizationId,
    );

    await this.certificationRepository.update(
      { id: certificationId },
      {
        status: 'revoked',
        revokedAt: new Date(),
      },
    );

    this.logger.log(
      `Certification revoked: ${certificationId}`,
      'CertificationService',
    );

    return this.getCertification(certificationId, organizationId);
  }

  async getActiveCertifications(organizationId: string): Promise<Certification[]> {
    return this.certificationRepository.find({
      where: { organizationId, status: 'certified' },
      order: { expiresAt: 'ASC' },
    });
  }

  async getExpiringCertifications(
    organizationId: string,
    daysThreshold: number = 30,
  ): Promise<Certification[]> {
    return this.certificationRepository.query(
      `SELECT * FROM compliance.certifications
       WHERE "organizationId" = $1
       AND status = 'certified'
       AND EXTRACT(DAY FROM "expiresAt" - NOW()) <= $2
       AND EXTRACT(DAY FROM "expiresAt" - NOW()) > 0
       ORDER BY "expiresAt" ASC`,
      [organizationId, daysThreshold],
    );
  }

  async getCertificationStatus(organizationId: string) {
    const total = await this.certificationRepository.count({
      where: { organizationId },
    });

    const active = await this.certificationRepository.count({
      where: { organizationId, status: 'certified' },
    });

    const expiring = await this.getExpiringCertifications(organizationId, 30);

    const expired = await this.certificationRepository.count({
      where: { organizationId, status: 'expired' },
    });

    const revoked = await this.certificationRepository.count({
      where: { organizationId, status: 'revoked' },
    });

    const inProgress = await this.certificationRepository.count({
      where: { organizationId, status: 'in_progress' },
    });

    const avgCompliancePercentage = await this.certificationRepository.query(
      `SELECT AVG("compliancePercentage") FROM compliance.certifications
       WHERE "organizationId" = $1`,
      [organizationId],
    );

    return {
      total,
      active,
      expiring: expiring.length,
      expired,
      revoked,
      inProgress,
      averageCompliancePercentage: parseFloat(
        avgCompliancePercentage[0].avg || 0,
      ).toFixed(2),
    };
  }
}
