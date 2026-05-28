import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Department } from './department.entity';
import { Team } from './team.entity';

@Entity('organizations', { schema: 'auth' })
@Index('idx_organizations_deleted_at', ['deletedAt'])
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  logoUrl: string;

  @Column({ type: 'varchar', length: 50, default: 'standard' })
  tier: string; // standard, professional, enterprise

  @Column({ type: 'integer', default: 100 })
  maxUsers: number;

  @Column({ type: 'integer', default: 1000 })
  maxWorkflows: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deletedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  // Relations
  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Role, (role) => role.organization)
  roles: Role[];

  @OneToMany(() => Department, (dept) => dept.organization)
  departments: Department[];

  @OneToMany(() => Team, (team) => team.organization)
  teams: Team[];
}
