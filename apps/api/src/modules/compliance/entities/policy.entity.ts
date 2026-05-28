import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity';
import { User } from '../../auth/entities/user.entity';
import { PolicyRule } from './policy-rule.entity';
import { Violation } from './violation.entity';

export type PolicyStatus = 'draft' | 'active' | 'archived' | 'under_review';

@Entity('policies', { schema: 'compliance' })
@Index('idx_policy_org_id', ['organizationId'])
@Index('idx_policy_status', ['status'])
@Index('idx_policy_category', ['category'])
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100 })
  category: string; // e.g., 'data-protection', 'safety', 'quality', 'security'

  @Column({ type: 'text' })
  definition: string; // JSON-serialized policy structure

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: PolicyStatus;

  @Column({ type: 'integer', default: 1 })
  versionNumber: number;

  @Column({ type: 'uuid', nullable: true })
  previousVersionId: string; // Reference to previous version

  @Column({ type: 'timestamp with time zone', nullable: true })
  activatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  archivedAt: Date;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  activatedBy: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 50, array: true, default: '{}' })
  applicableEvidenceTypes: string[]; // e.g., ['photo', 'document', 'signature']

  @Column({ type: 'integer', default: 0 })
  associatedRulesCount: number;

  @Column({ type: 'integer', default: 0 })
  totalViolations: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User)
  creator: User;

  @OneToMany(() => PolicyRule, (rule) => rule.policy)
  rules: PolicyRule[];

  @OneToMany(() => Violation, (violation) => violation.policy)
  violations: Violation[];

  get isActive(): boolean {
    return this.status === 'active';
  }

  get isPublished(): boolean {
    return this.status === 'active' || this.status === 'archived';
  }

  get violationRate(): number {
    return this.associatedRulesCount > 0
      ? (this.totalViolations / this.associatedRulesCount) * 100
      : 0;
  }
}
