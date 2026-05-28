import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Workflow } from './workflow.entity';

@Entity('tasks', { schema: 'workflow' })
@Index('idx_tasks_workflow_id', ['workflowId'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workflowId: string;

  @Column({ type: 'varchar', length: 50 })
  taskType: 'human' | 'system' | 'approval' | 'verification' | 'webhook';

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'integer' })
  positionIndex: number;

  @Column({ type: 'jsonb' })
  config: Record<string, any>;

  @Column({ type: 'jsonb', default: '[]' })
  requiredEvidence: string[];

  @Column({ type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({ type: 'uuid', array: true, default: '{}' })
  approvalRoles: string[];

  @Column({ type: 'integer', nullable: true })
  slaHours: number;

  @Column({ type: 'jsonb', nullable: true })
  retryPolicy: Record<string, any>;

  @Column({ type: 'integer', nullable: true })
  timeoutHours: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => Workflow, (workflow) => workflow.tasks)
  workflow: Workflow;
}
