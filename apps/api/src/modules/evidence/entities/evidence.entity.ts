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
import { WorkflowRun } from '../../workflow/entities/workflow-run.entity';
import { TaskInstance } from '../../workflow/entities/task-instance.entity';

@Entity('evidence', { schema: 'evidence' })
@Index('idx_evidence_org_id', ['organizationId'])
@Index('idx_evidence_workflow_run_id', ['workflowRunId'])
@Index('idx_evidence_task_instance_id', ['taskInstanceId'])
@Index('idx_evidence_type', ['evidenceType'])
@Index('idx_evidence_ai_status', ['aiVerificationStatus'])
@Index('idx_evidence_created_at', ['createdAt'])
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  workflowRunId: string;

  @Column({ type: 'uuid', nullable: true })
  taskInstanceId: string;

  @Column({ type: 'uuid' })
  capturedBy: string;

  @Column({ type: 'varchar', length: 50 })
  evidenceType: 'photo' | 'video' | 'document' | 'signature' | 'gps' | 'sensor' | 'audio';

  @Column({ type: 'varchar', length: 512, nullable: true })
  fileUrl: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  fileKey: string; // S3 key

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contentHash: string; // SHA256

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  // Location data
  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  locationAccuracy: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  locationTimestamp: Date;

  // Device data
  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceOs: string;

  @Column({ type: 'inet', nullable: true })
  deviceIp: string;

  // AI verification results
  @Column({ type: 'varchar', length: 50, nullable: true })
  aiVerificationStatus: 'pending' | 'verified' | 'flagged' | 'needs_review';

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  aiConfidenceScore: number;

  @Column({ type: 'jsonb', nullable: true })
  aiVerificationMetadata: Record<string, any>;

  @Column({ type: 'timestamp with time zone', nullable: true })
  aiVerifiedAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  aiVerifiedBy: string; // ocr, vision, ml_model

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User)
  capturer: User;

  @ManyToOne(() => WorkflowRun)
  workflowRun: WorkflowRun;

  @ManyToOne(() => TaskInstance)
  taskInstance: TaskInstance;

  get isVerified(): boolean {
    return this.aiVerificationStatus === 'verified';
  }

  get needsReview(): boolean {
    return this.aiVerificationStatus === 'needs_review' || this.aiVerificationStatus === 'flagged';
  }
}
