import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../entities/workflow.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { Task } from '../entities/task.entity';
import { TaskInstance } from '../entities/task-instance.entity';
import { Approval } from '../entities/approval.entity';
import { LoggerService } from '@observability/logger.service';

export interface ExecutionContext {
  workflowRunId: string;
  currentTaskIndex: number;
  variables: Record<string, any>;
  history: ExecutionEvent[];
}

export interface ExecutionEvent {
  timestamp: Date;
  taskId: string;
  type: 'task_started' | 'task_completed' | 'task_failed' | 'approval_pending' | 'approval_granted';
  data: Record<string, any>;
}

@Injectable()
export class ExecutionEngine {
  constructor(
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowRun)
    private workflowRunRepository: Repository<WorkflowRun>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(TaskInstance)
    private taskInstanceRepository: Repository<TaskInstance>,
    @InjectRepository(Approval)
    private approvalRepository: Repository<Approval>,
    private logger: LoggerService,
  ) {}

  async initiateWorkflow(
    workflowId: string,
    organizationId: string,
    userId: string,
    inputData?: Record<string, any>,
  ): Promise<WorkflowRun> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, organizationId },
      relations: ['tasks'],
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (!workflow.isPublished) {
      throw new BadRequestException('Workflow is not published');
    }

    // Validate input against schema
    if (workflow.inputSchema && inputData) {
      this.validateInput(inputData, workflow.inputSchema);
    }

    // Create workflow run
    const run = await this.workflowRunRepository.save({
      workflowId,
      organizationId,
      initiatedBy: userId,
      status: 'pending',
      inputData,
      progressPercentage: 0,
    });

    this.logger.log(`Workflow initiated: ${workflowId} (run: ${run.id})`, 'ExecutionEngine');

    // Initiate first task
    await this.executeNextTask(run.id);

    return run;
  }

  async executeNextTask(workflowRunId: string): Promise<TaskInstance | null> {
    const run = await this.workflowRunRepository.findOne({
      where: { id: workflowRunId },
      relations: ['workflow', 'taskInstances'],
    });

    if (!run) {
      throw new NotFoundException('Workflow run not found');
    }

    if (!run.isActive) {
      return null;
    }

    // Get all tasks for this workflow
    const tasks = await this.taskRepository.find({
      where: { workflowId: run.workflowId },
      order: { positionIndex: 'ASC' },
    });

    // Find next incomplete task
    const completedTaskIds = run.taskInstances
      ?.filter((t) => t.status === 'completed')
      .map((t) => t.taskId) || [];

    const nextTask = tasks.find((t) => !completedTaskIds.includes(t.id));

    if (!nextTask) {
      // All tasks completed
      await this.completeWorkflow(run.id);
      return null;
    }

    // Create task instance
    const taskInstance = await this.taskInstanceRepository.save({
      workflowRunId,
      taskId: nextTask.id,
      status: 'pending',
    });

    // Update workflow run progress
    const progress = Math.round(((completedTaskIds.length + 1) / tasks.length) * 100);
    await this.workflowRunRepository.update(run.id, {
      progressPercentage: progress,
      status: 'in_progress',
    });

    this.logger.log(
      `Task initiated: ${nextTask.name} (task instance: ${taskInstance.id})`,
      'ExecutionEngine',
    );

    // Execute task based on type
    await this.executeTask(taskInstance, nextTask);

    return taskInstance;
  }

  private async executeTask(taskInstance: TaskInstance, task: Task): Promise<void> {
    switch (task.taskType) {
      case 'human':
        // Assign to user
        await this.taskInstanceRepository.update(taskInstance.id, {
          status: 'assigned',
        });
        break;

      case 'system':
        // Execute system task
        await this.executeSystemTask(taskInstance, task);
        break;

      case 'approval':
        // Create approval request
        await this.createApprovalRequest(taskInstance, task);
        break;

      case 'verification':
        // Wait for verification evidence
        await this.taskInstanceRepository.update(taskInstance.id, {
          status: 'in_progress',
        });
        break;

      case 'webhook':
        // Call external webhook
        await this.executeWebhook(taskInstance, task);
        break;
    }
  }

  async completeTask(taskInstanceId: string, outputData?: Record<string, any>): Promise<void> {
    const taskInstance = await this.taskInstanceRepository.findOne({
      where: { id: taskInstanceId },
      relations: ['workflowRun', 'task'],
    });

    if (!taskInstance) {
      throw new NotFoundException('Task instance not found');
    }

    await this.taskInstanceRepository.update(taskInstanceId, {
      status: 'completed',
      completedAt: new Date(),
      outputData,
    });

    this.logger.log(`Task completed: ${taskInstanceId}`, 'ExecutionEngine');

    // Execute next task
    await this.executeNextTask(taskInstance.workflowRunId);
  }

  async failTask(taskInstanceId: string, failureReason: string): Promise<void> {
    const taskInstance = await this.taskInstanceRepository.findOne({
      where: { id: taskInstanceId },
    });

    if (!taskInstance) {
      throw new NotFoundException('Task instance not found');
    }

    const retryPolicy = taskInstance.task?.retryPolicy;

    if (retryPolicy && taskInstance.retryCount < (retryPolicy.maxRetries || 3)) {
      await this.taskInstanceRepository.update(taskInstanceId, {
        retryCount: taskInstance.retryCount + 1,
        failureReason,
        status: 'pending',
      });

      this.logger.log(`Task retrying: ${taskInstanceId} (attempt ${taskInstance.retryCount + 1})`, 'ExecutionEngine');
    } else {
      await this.taskInstanceRepository.update(taskInstanceId, {
        status: 'failed',
        failedAt: new Date(),
        failureReason,
      });

      await this.failWorkflow(taskInstance.workflowRunId, failureReason);
    }
  }

  private async createApprovalRequest(taskInstance: TaskInstance, task: Task): Promise<void> {
    const run = await this.workflowRunRepository.findOne({
      where: { id: taskInstance.workflowRunId },
    });

    const approvalRoles = task.approvalRoles || [];

    for (const roleId of approvalRoles) {
      // In Phase 2, we created roles but didn't complete role-based user lookup
      // This would fetch users with given role
      await this.approvalRepository.save({
        taskInstanceId: taskInstance.id,
        workflowRunId: taskInstance.workflowRunId,
        requestedBy: run.initiatedBy,
        assignedTo: run.initiatedBy, // TODO: Replace with user with approver role
        status: 'pending',
      });
    }

    await this.taskInstanceRepository.update(taskInstance.id, {
      status: 'in_progress',
    });
  }

  async approveTask(approvalId: string, decidedBy: string): Promise<void> {
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    await this.approvalRepository.update(approvalId, {
      status: 'approved',
      decidedAt: new Date(),
      decidedBy,
    });

    // Check if all approvals for this task are complete
    const pendingApprovals = await this.approvalRepository.find({
      where: { taskInstanceId: approval.taskInstanceId, status: 'pending' },
    });

    if (pendingApprovals.length === 0) {
      await this.completeTask(approval.taskInstanceId);
    }

    this.logger.log(`Task approved: ${approval.taskInstanceId}`, 'ExecutionEngine');
  }

  async rejectTask(approvalId: string, decidedBy: string, reason?: string): Promise<void> {
    const approval = await this.approvalRepository.findOne({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    await this.approvalRepository.update(approvalId, {
      status: 'rejected',
      decidedAt: new Date(),
      decidedBy,
      decision: reason,
    });

    await this.failTask(approval.taskInstanceId, `Task rejected: ${reason || 'No reason provided'}`);

    this.logger.log(`Task rejected: ${approval.taskInstanceId}`, 'ExecutionEngine');
  }

  private async completeWorkflow(workflowRunId: string): Promise<void> {
    await this.workflowRunRepository.update(workflowRunId, {
      status: 'completed',
      completedAt: new Date(),
      progressPercentage: 100,
    });

    this.logger.log(`Workflow completed: ${workflowRunId}`, 'ExecutionEngine');
  }

  private async failWorkflow(workflowRunId: string, errorMessage: string): Promise<void> {
    await this.workflowRunRepository.update(workflowRunId, {
      status: 'failed',
      errorMessage,
    });

    this.logger.error(`Workflow failed: ${workflowRunId} - ${errorMessage}`, '', 'ExecutionEngine');
  }

  private async executeSystemTask(taskInstance: TaskInstance, task: Task): Promise<void> {
    // Execute based on task config
    const config = task.config;

    if (config.type === 'data_transform') {
      // Apply transformation
      const transformed = this.applyTransformation(config.transformation, taskInstance.inputData);
      await this.completeTask(taskInstance.id, transformed);
    } else if (config.type === 'notification') {
      // Send notification
      this.logger.log(`Sending notification: ${config.message}`, 'ExecutionEngine');
      await this.completeTask(taskInstance.id);
    }
  }

  private async executeWebhook(taskInstance: TaskInstance, task: Task): Promise<void> {
    const config = task.config;
    // TODO: Implement webhook execution in Phase 9 (Integrations)
    this.logger.log(`Webhook would be called: ${config.url}`, 'ExecutionEngine');
    await this.completeTask(taskInstance.id);
  }

  private applyTransformation(transformation: any, data: any): Record<string, any> {
    // Simple transformation logic
    return data;
  }

  private validateInput(data: Record<string, any>, schema: Record<string, any>): void {
    // TODO: Implement full JSON Schema validation
  }

  async cancelWorkflow(workflowRunId: string): Promise<void> {
    await this.workflowRunRepository.update(workflowRunId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    this.logger.log(`Workflow cancelled: ${workflowRunId}`, 'ExecutionEngine');
  }
}
