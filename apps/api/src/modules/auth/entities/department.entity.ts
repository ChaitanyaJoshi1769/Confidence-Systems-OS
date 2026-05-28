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
import { Organization } from './organization.entity';

@Entity('departments', { schema: 'auth' })
@Index('idx_departments_org_id', ['organizationId'])
@Index('idx_departments_parent_id', ['parentDepartmentId'])
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  parentDepartmentId: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  // Relations
  @ManyToOne(() => Organization, (org) => org.departments)
  organization: Organization;

  @ManyToOne(() => Department)
  parentDepartment: Department;

  @OneToMany(() => Department, (dept) => dept.parentDepartment)
  childDepartments: Department[];
}
