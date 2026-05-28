import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../entities/policy.entity';
import { PolicyRule } from '../entities/policy-rule.entity';
import { LoggerService } from '@observability/logger.service';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    @InjectRepository(PolicyRule)
    private policyRuleRepository: Repository<PolicyRule>,
    private logger: LoggerService,
  ) {}

  async createPolicy(data: {
    organizationId: string;
    name: string;
    description?: string;
    category: string;
    definition: string | object;
    applicableEvidenceTypes?: string[];
    createdBy: string;
  }): Promise<Policy> {
    const policy = await this.policyRepository.save({
      organizationId: data.organizationId,
      name: data.name,
      description: data.description,
      category: data.category,
      definition: typeof data.definition === 'string' ? data.definition : JSON.stringify(data.definition),
      applicableEvidenceTypes: data.applicableEvidenceTypes || [],
      createdBy: data.createdBy,
      status: 'draft',
      versionNumber: 1,
    });

    this.logger.log(`Policy created: ${policy.id} (${policy.name})`, 'PolicyService');
    return policy;
  }

  async getPolicy(policyId: string, organizationId: string): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, organizationId },
      relations: ['rules'],
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  async listPolicies(
    organizationId: string,
    filters?: {
      category?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query = this.policyRepository
      .createQueryBuilder('p')
      .where('p.organizationId = :organizationId', { organizationId })
      .leftJoinAndSelect('p.rules', 'rules');

    if (filters?.category) {
      query.andWhere('p.category = :category', { category: filters.category });
    }

    if (filters?.status) {
      query.andWhere('p.status = :status', { status: filters.status });
    }

    query.orderBy('p.createdAt', 'DESC');

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [policies, total] = await query.take(limit).skip(offset).getManyAndCount();

    return { policies, total, limit, offset };
  }

  async updatePolicy(
    policyId: string,
    organizationId: string,
    data: {
      name?: string;
      description?: string;
      definition?: string | object;
      applicableEvidenceTypes?: string[];
    },
  ): Promise<Policy> {
    const policy = await this.getPolicy(policyId, organizationId);

    if (policy.status !== 'draft') {
      throw new BadRequestException('Can only edit draft policies');
    }

    const updates = {
      ...data,
      definition: data.definition ? (typeof data.definition === 'string' ? data.definition : JSON.stringify(data.definition)) : policy.definition,
    };

    await this.policyRepository.update({ id: policyId }, updates);
    return this.getPolicy(policyId, organizationId);
  }

  async publishPolicy(
    policyId: string,
    organizationId: string,
    publishedBy: string,
  ): Promise<Policy> {
    const policy = await this.getPolicy(policyId, organizationId);

    if (policy.status === 'active') {
      throw new BadRequestException('Policy is already active');
    }

    if (!policy.rules || policy.rules.length === 0) {
      throw new BadRequestException('Policy must have at least one rule before publishing');
    }

    await this.policyRepository.update(
      { id: policyId },
      {
        status: 'active',
        activatedAt: new Date(),
        activatedBy: publishedBy,
      },
    );

    this.logger.log(`Policy published: ${policy.id}`, 'PolicyService');
    return this.getPolicy(policyId, organizationId);
  }

  async archivePolicy(
    policyId: string,
    organizationId: string,
  ): Promise<Policy> {
    const policy = await this.getPolicy(policyId, organizationId);

    await this.policyRepository.update(
      { id: policyId },
      {
        status: 'archived',
        archivedAt: new Date(),
      },
    );

    this.logger.log(`Policy archived: ${policy.id}`, 'PolicyService');
    return this.getPolicy(policyId, organizationId);
  }

  async createPolicyVersion(
    policyId: string,
    organizationId: string,
    createdBy: string,
  ): Promise<Policy> {
    const original = await this.getPolicy(policyId, organizationId);

    if (original.status !== 'active') {
      throw new BadRequestException('Can only version active policies');
    }

    const newVersion = await this.policyRepository.save({
      organizationId,
      name: original.name,
      description: original.description,
      category: original.category,
      definition: original.definition,
      applicableEvidenceTypes: original.applicableEvidenceTypes,
      createdBy,
      status: 'draft',
      versionNumber: original.versionNumber + 1,
      previousVersionId: original.id,
    });

    this.logger.log(
      `Policy versioned: ${original.id} -> ${newVersion.id} (v${newVersion.versionNumber})`,
      'PolicyService',
    );

    return newVersion;
  }

  async getPoliciesByCategory(
    organizationId: string,
    category: string,
  ): Promise<Policy[]> {
    return this.policyRepository.find({
      where: { organizationId, category, status: 'active' },
      relations: ['rules'],
    });
  }

  async getActivePolicies(organizationId: string): Promise<Policy[]> {
    return this.policyRepository.find({
      where: { organizationId, status: 'active' },
      relations: ['rules'],
    });
  }

  async updatePolicyViolationCount(policyId: string): Promise<void> {
    const violationCount = await this.policyRepository.query(
      'SELECT COUNT(*) FROM compliance.violations WHERE "policyId" = $1',
      [policyId],
    );

    await this.policyRepository.update(
      { id: policyId },
      { totalViolations: parseInt(violationCount[0].count, 10) },
    );
  }
}
