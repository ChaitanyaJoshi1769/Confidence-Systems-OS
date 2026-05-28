import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditLogEntry {
  organizationId: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'api';
  action: string;
  resourceType?: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLog> {
    return this.auditLogsRepository.save({
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      actorType: entry.actorType,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      changes: entry.changes,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });
  }

  async getAuditLogs(
    organizationId: string,
    filters?: {
      actorId?: string;
      resourceType?: string;
      resourceId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query = this.auditLogsRepository
      .createQueryBuilder('al')
      .where('al.organizationId = :organizationId', { organizationId });

    if (filters?.actorId) {
      query.andWhere('al.actorId = :actorId', { actorId: filters.actorId });
    }

    if (filters?.resourceType) {
      query.andWhere('al.resourceType = :resourceType', { resourceType: filters.resourceType });
    }

    if (filters?.resourceId) {
      query.andWhere('al.resourceId = :resourceId', { resourceId: filters.resourceId });
    }

    if (filters?.action) {
      query.andWhere('al.action = :action', { action: filters.action });
    }

    query.orderBy('al.createdAt', 'DESC');

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const [logs, total] = await query
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { logs, total, limit, offset };
  }

  async getResourceAuditTrail(
    organizationId: string,
    resourceType: string,
    resourceId: string,
  ) {
    return this.auditLogsRepository.find({
      where: {
        organizationId,
        resourceType,
        resourceId,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
