import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Role } from './role.entity';
import { AuditLog } from './audit-log.entity';
import { Session } from './session.entity';

@Entity('users', { schema: 'auth' })
@Index('idx_users_org_id', ['organizationId'])
@Index('idx_users_email', ['email'])
@Index('idx_users_deleted_at', ['deletedAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatarUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  emailVerifiedAt: Date;

  @Column({ type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  phoneVerifiedAt: Date;

  @Column({ type: 'boolean', default: false })
  mfaEnabled: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mfaMethod: string; // totp, sms, email

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  mfaSecret: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'inet', nullable: true })
  lastLoginIp: string;

  @Column({ type: 'text', nullable: true })
  lastLoginUserAgent: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deletedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  // Relations
  @ManyToOne(() => Organization, (org) => org.users)
  organization: Organization;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
    schema: 'auth',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @OneToMany(() => AuditLog, (log) => log.actor)
  auditLogs: AuditLog[];

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  get fullName(): string {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  get isActive(): boolean {
    return !this.deletedAt;
  }
}
