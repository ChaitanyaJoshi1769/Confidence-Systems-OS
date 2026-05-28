import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity';
import { WorkflowRun } from './entities/workflow-run.entity';
import { Task } from './entities/task.entity';
import { TaskInstance } from './entities/task-instance.entity';
import { Approval } from './entities/approval.entity';
import { Checklist } from './entities/checklist.entity';
import { WorkflowService } from './services/workflow.service';
import { ExecutionEngine } from './services/execution-engine.service';
import { WorkflowController } from './controllers/workflow.controller';
import { Organization } from '../auth/entities/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workflow,
      WorkflowRun,
      Task,
      TaskInstance,
      Approval,
      Checklist,
      Organization,
    ]),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, ExecutionEngine],
  exports: [WorkflowService, ExecutionEngine],
})
export class WorkflowModule {}
