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
import { Policy } from './policy.entity';
import { Violation } from './violation.entity';

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RuleType = 'condition' | 'calculation' | 'script' | 'ml_model' | 'external_service';

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'regex' | 'script';
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'json';
}

export interface RuleAction {
  type: 'flag_violation' | 'create_alert' | 'notify_stakeholders' | 'escalate' | 'block_workflow' | 'tag_evidence' | 'call_webhook';
  params: Record<string, any>;
  severity: RuleSeverity;
}

@Entity('policy_rules', { schema: 'compliance' })
@Index('idx_rule_policy_id', ['policyId'])
@Index('idx_rule_org_id', ['organizationId'])
@Index('idx_rule_severity', ['severity'])
@Index('idx_rule_type', ['ruleType'])
export class PolicyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  policyId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  ruleType: RuleType;

  @Column({ type: 'varchar', length: 50 })
  severity: RuleSeverity;

  @Column({ type: 'jsonb' })
  conditions: RuleCondition[] | string; // Can be JSON or a script/formula

  @Column({ type: 'jsonb' })
  actions: RuleAction[];

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'integer', default: 0 })
  executionCount: number;

  @Column({ type: 'integer', default: 0 })
  violationCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  executionTimeMs: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastExecutedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => Policy, (policy) => policy.rules, { onDelete: 'CASCADE' })
  policy: Policy;

  @OneToMany(() => Violation, (violation) => violation.rule)
  violations: Violation[];

  get violationRate(): number {
    return this.executionCount > 0
      ? (this.violationCount / this.executionCount) * 100
      : 0;
  }

  get isHighRisk(): boolean {
    return this.severity === 'critical' || this.severity === 'high';
  }
}
