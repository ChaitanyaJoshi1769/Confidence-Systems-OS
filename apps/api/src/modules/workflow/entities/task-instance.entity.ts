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
import { WorkflowRun } from './workflow-run.entity';
import { Task } from './task.entity';
import { User } from '../../auth/entities/user.entity';
import { Approval } from './approval.entity';

@Entity('task_instances', { schema: 'workflow' })
@Index('idx_task_instances_workflow_run_id', ['workflowRunId'])
@Index('idx_task_instances_task_id', ['taskId'])
@Index('idx_task_instances_status', ['status'])
export class TaskInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workflowRunId: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'skipped';

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string;

  @Column({ type: 'jsonb', nullable: true })
  inputData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  outputData: Record<string, any>;

  @Column({ type: 'uuid', array: true, default: '{}' })
  evidenceIds: string[];

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  failedAt: Date;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => WorkflowRun, (run) => run.taskInstances)
  workflowRun: WorkflowRun;

  @ManyToOne(() => Task)
  task: Task;

  @ManyToOne(() => User)
  assignee: User;

  @OneToMany(() => Approval, (approval) => approval.taskInstance)
  approvals: Approval[];

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isPending(): boolean {
    return ['pending', 'assigned'].includes(this.status);
  }
}
