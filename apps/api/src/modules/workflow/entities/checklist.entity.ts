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

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
}

@Entity('checklists', { schema: 'workflow' })
@Index('idx_checklists_task_instance_id', ['taskInstanceId'])
export class Checklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskInstanceId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'jsonb' })
  items: ChecklistItem[];

  @Column({ type: 'integer', default: 0 })
  completedItemsCount: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => TaskInstance)
  taskInstance: TaskInstance;

  get totalItems(): number {
    return this.items.length;
  }

  get completionPercentage(): number {
    if (this.totalItems === 0) return 0;
    return (this.completedItemsCount / this.totalItems) * 100;
  }

  get isComplete(): boolean {
    return this.completedItemsCount === this.totalItems;
  }
}
