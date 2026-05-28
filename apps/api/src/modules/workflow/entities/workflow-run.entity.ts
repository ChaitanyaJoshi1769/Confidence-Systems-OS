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
import { Workflow } from './workflow.entity';
import { Organization } from '../../auth/entities/organization.entity';
import { User } from '../../auth/entities/user.entity';
import { TaskInstance } from './task-instance.entity';

@Entity('workflow_runs', { schema: 'workflow' })
@Index('idx_workflow_runs_workflow_id', ['workflowId'])
@Index('idx_workflow_runs_org_id', ['organizationId'])
@Index('idx_workflow_runs_status', ['status'])
export class WorkflowRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workflowId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  initiatedBy: string;

  @Column({ type: 'uuid', nullable: true })
  parentRunId: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

  @Column({ type: 'integer', default: 0 })
  progressPercentage: number;

  @Column({ type: 'jsonb', nullable: true })
  inputData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  outputData: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  errorStack: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @ManyToOne(() => Workflow)
  workflow: Workflow;

  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User)
  initiator: User;

  @OneToMany(() => TaskInstance, (task) => task.workflowRun)
  taskInstances: TaskInstance[];

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }

  get isActive(): boolean {
    return ['pending', 'in_progress'].includes(this.status);
  }
}
