import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Organization } from '../../auth/entities/organization.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('replay_events', { schema: 'evidence' })
@Index('idx_replay_events_org_id', ['organizationId'])
@Index('idx_replay_events_aggregate', ['aggregateType', 'aggregateId'])
@Index('idx_replay_events_timestamp', ['timestamp'])
@Index('idx_replay_events_event_type', ['eventType'])
export class ReplayEvent {
  @PrimaryGeneratedColumn('bigint')
  id: number;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  aggregateId: string;

  @Column({ type: 'varchar', length: 50 })
  aggregateType: 'workflow_run' | 'task_instance' | 'evidence';

  @Column({ type: 'varchar', length: 255 })
  eventType: string;

  @Column({ type: 'jsonb' })
  eventData: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  actorId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorType: string;

  @Column({ type: 'timestamp with time zone' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User)
  actor: User;
}
