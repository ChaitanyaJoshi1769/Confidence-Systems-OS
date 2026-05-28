import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from '../services/workflow.service';
import { ExecutionEngine } from '../services/execution-engine.service';

@ApiTags('Workflows')
@Controller('workflows')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access_token')
export class WorkflowController {
  constructor(
    private workflowService: WorkflowService,
    private executionEngine: ExecutionEngine,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow' })
  async createWorkflow(@Body() data: any, @Request() req: any) {
    return this.workflowService.createWorkflow(
      req.user.organizationId,
      req.user.userId,
      data,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  async listWorkflows(@Query() query: any, @Request() req: any) {
    return this.workflowService.listWorkflows(req.user.organizationId, {
      status: query.status,
      tags: query.tags?.split(','),
      limit: query.limit || 20,
      offset: query.offset || 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow details' })
  async getWorkflow(@Param('id') workflowId: string, @Request() req: any) {
    return this.workflowService.getWorkflow(workflowId, req.user.organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update workflow' })
  async updateWorkflow(
    @Param('id') workflowId: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.workflowService.updateWorkflow(
      workflowId,
      req.user.organizationId,
      data,
    );
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish workflow' })
  async publishWorkflow(@Param('id') workflowId: string, @Request() req: any) {
    return this.workflowService.publishWorkflow(
      workflowId,
      req.user.organizationId,
    );
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive workflow' })
  async archiveWorkflow(@Param('id') workflowId: string, @Request() req: any) {
    await this.workflowService.archiveWorkflow(workflowId, req.user.organizationId);
    return { message: 'Workflow archived' };
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Execute workflow' })
  async executeWorkflow(
    @Param('id') workflowId: string,
    @Body() data: { inputData?: Record<string, any> },
    @Request() req: any,
  ) {
    return this.executionEngine.initiateWorkflow(
      workflowId,
      req.user.organizationId,
      req.user.userId,
      data.inputData,
    );
  }

  @Get(':id/runs')
  @ApiOperation({ summary: 'List workflow runs' })
  async getWorkflowRuns(
    @Param('id') workflowId: string,
    @Query() query: any,
    @Request() req: any,
  ) {
    return this.workflowService.getWorkflowRuns(
      workflowId,
      req.user.organizationId,
      {
        status: query.status,
        limit: query.limit || 20,
        offset: query.offset || 0,
      },
    );
  }

  @Get(':id/runs/:runId')
  @ApiOperation({ summary: 'Get workflow run details' })
  async getWorkflowRunDetails(
    @Param('id') workflowId: string,
    @Param('runId') runId: string,
    @Request() req: any,
  ) {
    return this.workflowService.getWorkflowRunDetails(runId, req.user.organizationId);
  }

  @Post(':id/runs/:runId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel workflow run' })
  async cancelWorkflowRun(
    @Param('id') workflowId: string,
    @Param('runId') runId: string,
    @Request() req: any,
  ) {
    await this.executionEngine.cancelWorkflow(runId);
    return { message: 'Workflow run cancelled' };
  }

  @Post('tasks/:taskInstanceId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete task' })
  async completeTask(
    @Param('taskInstanceId') taskInstanceId: string,
    @Body() data: { outputData?: Record<string, any> },
  ) {
    await this.executionEngine.completeTask(taskInstanceId, data.outputData);
    return { message: 'Task completed' };
  }

  @Post('approvals/:approvalId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve task' })
  async approveTask(
    @Param('approvalId') approvalId: string,
    @Request() req: any,
  ) {
    await this.executionEngine.approveTask(approvalId, req.user.userId);
    return { message: 'Task approved' };
  }

  @Post('approvals/:approvalId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject task' })
  async rejectTask(
    @Param('approvalId') approvalId: string,
    @Body() data: { reason?: string },
    @Request() req: any,
  ) {
    await this.executionEngine.rejectTask(approvalId, req.user.userId, data.reason);
    return { message: 'Task rejected' };
  }
}
