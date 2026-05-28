import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evidence } from '../entities/evidence.entity';
import { EvidencePacket } from '../entities/evidence-packet.entity';
import { ReplayEvent } from '../entities/replay-event.entity';
import { LoggerService } from '@observability/logger.service';
import * as crypto from 'crypto';

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
    @InjectRepository(EvidencePacket)
    private evidencePacketRepository: Repository<EvidencePacket>,
    @InjectRepository(ReplayEvent)
    private replayEventRepository: Repository<ReplayEvent>,
    private logger: LoggerService,
  ) {}

  async createEvidence(data: {
    organizationId: string;
    workflowRunId: string;
    taskInstanceId?: string;
    capturedBy: string;
    evidenceType: string;
    fileUrl?: string;
    fileKey?: string;
    fileSize?: number;
    mimeType?: string;
    deviceId?: string;
    deviceName?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<Evidence> {
    const evidence = await this.evidenceRepository.save({
      ...data,
      contentHash: this.generateHash(),
      aiVerificationStatus: 'pending',
    });

    // Log event
    await this.logReplayEvent({
      organizationId: data.organizationId,
      aggregateId: data.workflowRunId,
      aggregateType: 'evidence',
      eventType: 'evidence.captured',
      eventData: { evidenceId: evidence.id, type: data.evidenceType },
      actorId: data.capturedBy,
    });

    this.logger.log(`Evidence captured: ${evidence.id}`, 'EvidenceService');

    return evidence;
  }

  async getEvidence(evidenceId: string, organizationId: string): Promise<Evidence> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, organizationId },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    return evidence;
  }

  async listEvidence(
    organizationId: string,
    filters?: {
      workflowRunId?: string;
      taskInstanceId?: string;
      evidenceType?: string;
      aiStatus?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query = this.evidenceRepository
      .createQueryBuilder('e')
      .where('e.organizationId = :organizationId', { organizationId });

    if (filters?.workflowRunId) {
      query.andWhere('e.workflowRunId = :workflowRunId', { workflowRunId: filters.workflowRunId });
    }

    if (filters?.taskInstanceId) {
      query.andWhere('e.taskInstanceId = :taskInstanceId', { taskInstanceId: filters.taskInstanceId });
    }

    if (filters?.evidenceType) {
      query.andWhere('e.evidenceType = :evidenceType', { evidenceType: filters.evidenceType });
    }

    if (filters?.aiStatus) {
      query.andWhere('e.aiVerificationStatus = :status', { status: filters.aiStatus });
    }

    query.orderBy('e.createdAt', 'DESC');

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [evidence, total] = await query
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { evidence, total, limit, offset };
  }

  async updateAIVerification(
    evidenceId: string,
    verification: {
      status: 'verified' | 'flagged' | 'needs_review';
      confidenceScore: number;
      metadata: Record<string, any>;
      verifiedBy: string;
    },
  ): Promise<Evidence> {
    await this.evidenceRepository.update(
      { id: evidenceId },
      {
        aiVerificationStatus: verification.status,
        aiConfidenceScore: verification.confidenceScore,
        aiVerificationMetadata: verification.metadata,
        aiVerifiedAt: new Date(),
        aiVerifiedBy: verification.verifiedBy,
      },
    );

    return this.evidenceRepository.findOne({ where: { id: evidenceId } });
  }

  async createEvidencePacket(data: {
    organizationId: string;
    workflowRunId: string;
    name: string;
    evidenceIds: string[];
    createdBy: string;
  }): Promise<EvidencePacket> {
    const packet = await this.evidencePacketRepository.save({
      ...data,
      packetHash: this.generateHash(),
    });

    this.logger.log(`Evidence packet created: ${packet.id}`, 'EvidenceService');

    return packet;
  }

  async logReplayEvent(data: {
    organizationId: string;
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    eventData: Record<string, any>;
    actorId?: string;
    actorType?: string;
  }): Promise<ReplayEvent> {
    return this.replayEventRepository.save({
      ...data,
      timestamp: new Date(),
    });
  }

  async getAuditTrail(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
  ): Promise<ReplayEvent[]> {
    return this.replayEventRepository.find({
      where: { organizationId, aggregateType, aggregateId },
      order: { timestamp: 'DESC' },
    });
  }

  async replayWorkflowHistory(organizationId: string, workflowRunId: string) {
    const events = await this.getAuditTrail(organizationId, 'workflow_run', workflowRunId);
    return {
      workflowRunId,
      events: events.map((e) => ({
        timestamp: e.timestamp,
        eventType: e.eventType,
        data: e.eventData,
      })),
    };
  }

  private generateHash(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
