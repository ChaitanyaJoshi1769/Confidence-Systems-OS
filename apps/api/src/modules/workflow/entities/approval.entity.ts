import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { TaskInstance } from './task-instance.entity';
import { WorkflowRun } from './workflow-run.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('approvals', { schema: 'workflow' })
@Index('idx_approvals_task_instance_id', ['taskInstanceId'])
@Index('idx_approvals_assigned_to', ['assignedTo'])
@Index('idx_approvals_status', ['status'])
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskInstanceId: string;

  @Column({ type: 'uuid' })
  workflowRunId: string;

  @Column({ type: 'uuid' })
  requestedBy: string;

  @Column({ type: 'uuid' })
  assignedTo: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'reassigned';

  @Column({ type: 'text', nullable: true })
  decision: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  decidedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  decidedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  escalatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  escalatedTo: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => TaskInstance, (task) => task.approvals)
  taskInstance: TaskInstance;

  @ManyToOne(() => WorkflowRun)
  workflowRun: WorkflowRun;

  @ManyToOne(() => User)
  requestor: User;

  @ManyToOne(() => User)
  assignee: User;

  @ManyToOne(() => User)
  decider: User;

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isApproved(): boolean {
    return this.status === 'approved';
  }

  get isRejected(): boolean {
    return this.status === 'rejected';
  }
}
