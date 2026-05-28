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
import { User } from '../../auth/entities/user.entity';
import { Organization } from '../../auth/entities/organization.entity';
import { WorkflowRun } from './workflow-run.entity';
import { Task } from './task.entity';

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  tasks: TaskDefinition[];
  triggers?: TriggerDefinition[];
  conditions?: ConditionDefinition[];
  metadata?: Record<string, any>;
}

export interface TaskDefinition {
  id: string;
  type: 'human' | 'system' | 'approval' | 'verification' | 'webhook';
  name: string;
  description?: string;
  config: Record<string, any>;
  requiredEvidence?: string[];
  nextTasks?: string[]; // Task IDs that follow
  conditions?: ConditionDefinition[];
}

export interface TriggerDefinition {
  type: 'manual' | 'scheduled' | 'event' | 'webhook';
  config: Record<string, any>;
}

export interface ConditionDefinition {
  type: string;
  expression: Record<string, any>;
}

@Entity('workflows', { schema: 'workflow' })
@Index('idx_workflows_org_id', ['organizationId'])
@Index('idx_workflows_status', ['status'])
@Index('idx_workflows_tags', ['tags'], { where: '"tags" IS NOT NULL' })
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @Column({ type: 'integer', default: 1 })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  definition: WorkflowDefinition;

  @Column({ type: 'jsonb', nullable: true })
  inputSchema: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  outputSchema: Record<string, any>;

  @Column({ type: 'jsonb', default: '[]' })
  tags: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  publishedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  archivedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  // Relations
  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User)
  creator: User;

  @OneToMany(() => WorkflowRun, (run) => run.workflow)
  runs: WorkflowRun[];

  @OneToMany(() => Task, (task) => task.workflow)
  tasks: Task[];

  get isPublished(): boolean {
    return this.status === 'published';
  }

  get isArchived(): boolean {
    return this.status === 'archived';
  }
}
