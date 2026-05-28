import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity';
import { Policy } from './policy.entity';
import { PolicyRule } from './policy-rule.entity';
import { User } from '../../auth/entities/user.entity';

export type ViolationStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'false_positive';
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

@Entity('violations', { schema: 'compliance' })
@Index('idx_violation_org_id', ['organizationId'])
@Index('idx_violation_policy_id', ['policyId'])
@Index('idx_violation_rule_id', ['ruleId'])
@Index('idx_violation_status', ['status'])
@Index('idx_violation_severity', ['severity'])
@Index('idx_violation_resource', ['resourceType', 'resourceId'])
export class Violation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  policyId: string;

  @Column({ type: 'uuid' })
  ruleId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  severity: ViolationSeverity;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  status: ViolationStatus;

  @Column({ type: 'varchar', length: 100 })
  resourceType: string; // e.g., 'evidence', 'workflow_run', 'task_instance'

  @Column({ type: 'uuid' })
  resourceId: string;

  @Column({ type: 'jsonb' })
  ruleContext: Record<string, any>; // The conditions that triggered the violation

  @Column({ type: 'jsonb' })
  evidenceData: Record<string, any>; // Snapshot of the evidence at violation time

  @Column({ type: 'uuid', nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remediationAction: string;

  @Column({ type: 'boolean', default: false })
  requiresReview: boolean;

  @Column({ type: 'integer', default: 0 })
  escalationLevel: number; // 0 = not escalated, 1, 2, 3 = increasing escalation

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => Policy)
  policy: Policy;

  @ManyToOne(() => PolicyRule)
  rule: PolicyRule;

  @ManyToOne(() => User, { nullable: true })
  acknowledger: User;

  @ManyToOne(() => User, { nullable: true })
  resolver: User;

  get isPending(): boolean {
    return this.status === 'open' || this.status === 'acknowledged';
  }

  get isResolved(): boolean {
    return this.status === 'resolved' || this.status === 'false_positive';
  }

  get daysOpen(): number {
    const now = new Date();
    const diff = now.getTime() - this.createdAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  get isCritical(): boolean {
    return this.severity === 'critical' && this.isPending;
  }
}
