import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity';
import { User } from '../../auth/entities/user.entity';

export type CertificationStatus = 'in_progress' | 'certified' | 'expired' | 'revoked' | 'pending_renewal';

@Entity('certifications', { schema: 'compliance' })
@Index('idx_cert_org_id', ['organizationId'])
@Index('idx_cert_type', ['certificationType'])
@Index('idx_cert_status', ['status'])
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  certificationType: string; // e.g., 'ISO-27001', 'SOC2', 'HIPAA', 'GDPR'

  @Column({ type: 'varchar', length: 255 })
  certificationName: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'in_progress' })
  status: CertificationStatus;

  @Column({ type: 'timestamp with time zone' })
  issuedAt: Date;

  @Column({ type: 'timestamp with time zone' })
  expiresAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  certificationBody: string; // e.g., 'Bureau Veritas', 'Deloitte'

  @Column({ type: 'varchar', length: 255, nullable: true })
  auditReference: string;

  @Column({ type: 'integer', default: 0 })
  requiredPoliciesCount: number;

  @Column({ type: 'integer', default: 0 })
  implementedPoliciesCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  compliancePercentage: number;

  @Column({ type: 'jsonb', default: '[]' })
  requirementsMet: string[]; // Array of requirement IDs that are met

  @Column({ type: 'jsonb', default: '[]' })
  requirementsPending: string[]; // Requirements still being worked on

  @Column({ type: 'text', nullable: true })
  auditFindings: string;

  @Column({ type: 'text', nullable: true })
  improvementAreas: string;

  @Column({ type: 'uuid' })
  maintainedBy: string; // User responsible for maintaining certification

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User)
  maintainer: User;

  get isActive(): boolean {
    return this.status === 'certified' && new Date() < this.expiresAt;
  }

  get daysToExpiration(): number {
    const diff = this.expiresAt.getTime() - new Date().getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  get isExpiringSoon(): boolean {
    return this.daysToExpiration < 30 && this.daysToExpiration > 0;
  }

  get isExpired(): boolean {
    return new Date() > this.expiresAt && this.status !== 'revoked';
  }

  get completionPercentage(): number {
    return this.requiredPoliciesCount > 0
      ? (this.implementedPoliciesCount / this.requiredPoliciesCount) * 100
      : 0;
  }
}
