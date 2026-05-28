import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity';
import { WorkflowRun } from '../../workflow/entities/workflow-run.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('evidence_packets', { schema: 'evidence' })
@Index('idx_evidence_packets_org_id', ['organizationId'])
@Index('idx_evidence_packets_workflow_run_id', ['workflowRunId'])
export class EvidencePacket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  workflowRunId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid', array: true })
  evidenceIds: string[];

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  packetHash: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => WorkflowRun)
  workflowRun: WorkflowRun;

  @ManyToOne(() => User)
  creator: User;
}
