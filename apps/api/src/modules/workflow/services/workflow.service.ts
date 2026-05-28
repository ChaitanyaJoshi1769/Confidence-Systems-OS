import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow, WorkflowDefinition } from '../entities/workflow.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { Task } from '../entities/task.entity';
import { Organization } from '../../auth/entities/organization.entity';
import { LoggerService } from '@observability/logger.service';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowRun)
    private workflowRunRepository: Repository<WorkflowRun>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private logger: LoggerService,
  ) {}

  async createWorkflow(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      definition: WorkflowDefinition;
      inputSchema?: Record<string, any>;
      outputSchema?: Record<string, any>;
      tags?: string[];
    },
  ): Promise<Workflow> {
    const slug = this.generateSlug(data.name);

    const existingWorkflow = await this.workflowRepository.findOne({
      where: { organizationId, slug },
    });

    if (existingWorkflow) {
      throw new ConflictException('Workflow with this name already exists');
    }

    const workflow = await this.workflowRepository.save({
      organizationId,
      createdBy: userId,
      name: data.name,
      description: data.description,
      slug,
      definition: data.definition,
      inputSchema: data.inputSchema,
      outputSchema: data.outputSchema,
      tags: data.tags || [],
      status: 'draft',
    });

    // Create task entities from definition
    await this.createTasksFromDefinition(workflow.id, data.definition);

    this.logger.log(`Workflow created: ${workflow.id}`, 'WorkflowService');

    return workflow;
  }

  async getWorkflow(workflowId: string, organizationId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, organizationId },
      relations: ['tasks'],
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async listWorkflows(
    organizationId: string,
    filters?: {
      status?: 'draft' | 'published' | 'archived';
      tags?: string[];
      limit?: number;
      offset?: number;
    },
  ) {
    const query = this.workflowRepository
      .createQueryBuilder('w')
      .where('w.organizationId = :organizationId', { organizationId })
      .andWhere('w.archivedAt IS NULL');

    if (filters?.status) {
      query.andWhere('w.status = :status', { status: filters.status });
    }

    query.orderBy('w.createdAt', 'DESC');

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [workflows, total] = await query
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { workflows, total, limit, offset };
  }

  async updateWorkflow(
    workflowId: string,
    organizationId: string,
    data: Partial<Workflow>,
  ): Promise<Workflow> {
    const workflow = await this.getWorkflow(workflowId, organizationId);

    if (workflow.isPublished) {
      throw new BadRequestException('Cannot modify published workflows. Create a new version instead.');
    }

    await this.workflowRepository.update({ id: workflowId }, {
      name: data.name || workflow.name,
      description: data.description || workflow.description,
      definition: data.definition || workflow.definition,
      tags: data.tags || workflow.tags,
    });

    this.logger.log(`Workflow updated: ${workflowId}`, 'WorkflowService');

    return this.getWorkflow(workflowId, organizationId);
  }

  async publishWorkflow(workflowId: string, organizationId: string): Promise<Workflow> {
    const workflow = await this.getWorkflow(workflowId, organizationId);

    if (workflow.isPublished) {
      throw new BadRequestException('Workflow is already published');
    }

    // Validate workflow definition
    this.validateWorkflowDefinition(workflow.definition);

    await this.workflowRepository.update(workflowId, {
      status: 'published',
      publishedAt: new Date(),
    });

    this.logger.log(`Workflow published: ${workflowId}`, 'WorkflowService');

    return this.getWorkflow(workflowId, organizationId);
  }

  async archiveWorkflow(workflowId: string, organizationId: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId, organizationId);

    await this.workflowRepository.update(workflowId, {
      status: 'archived',
      archivedAt: new Date(),
    });

    this.logger.log(`Workflow archived: ${workflowId}`, 'WorkflowService');
  }

  async getWorkflowRuns(
    workflowId: string,
    organizationId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query = this.workflowRunRepository
      .createQueryBuilder('wr')
      .where('wr.workflowId = :workflowId AND wr.organizationId = :organizationId', {
        workflowId,
        organizationId,
      });

    if (filters?.status) {
      query.andWhere('wr.status = :status', { status: filters.status });
    }

    query.orderBy('wr.createdAt', 'DESC');

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [runs, total] = await query
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { runs, total, limit, offset };
  }

  async getWorkflowRunDetails(runId: string, organizationId: string): Promise<WorkflowRun> {
    const run = await this.workflowRunRepository.findOne({
      where: { id: runId, organizationId },
      relations: ['workflow', 'taskInstances', 'taskInstances.task'],
    });

    if (!run) {
      throw new NotFoundException('Workflow run not found');
    }

    return run;
  }

  private async createTasksFromDefinition(workflowId: string, definition: WorkflowDefinition): Promise<void> {
    for (let i = 0; i < definition.tasks.length; i++) {
      const taskDef = definition.tasks[i];
      await this.taskRepository.save({
        workflowId,
        taskType: taskDef.type,
        name: taskDef.name,
        description: taskDef.description,
        positionIndex: i,
        config: taskDef.config,
        requiredEvidence: taskDef.requiredEvidence || [],
      });
    }
  }

  private validateWorkflowDefinition(definition: WorkflowDefinition): void {
    if (!definition.tasks || definition.tasks.length === 0) {
      throw new BadRequestException('Workflow must have at least one task');
    }

    for (const task of definition.tasks) {
      if (!task.id || !task.type || !task.name) {
        throw new BadRequestException('Each task must have id, type, and name');
      }
    }
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
