import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyRule, RuleCondition } from '../entities/policy-rule.entity';
import { Violation } from '../entities/violation.entity';
import { LoggerService } from '@observability/logger.service';

export interface EvaluationContext {
  resourceId: string;
  resourceType: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EvaluationResult {
  ruleId: string;
  passed: boolean;
  violations: string[];
  executionTime: number;
}

@Injectable()
export class RuleEngineService {
  constructor(
    @InjectRepository(PolicyRule)
    private policyRuleRepository: Repository<PolicyRule>,
    @InjectRepository(Violation)
    private violationRepository: Repository<Violation>,
    private logger: LoggerService,
  ) {}

  async evaluatePolicy(
    policyId: string,
    organizationId: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult[]> {
    const rules = await this.policyRuleRepository.find({
      where: { policyId, isEnabled: true },
      relations: ['policy'],
    });

    const results: EvaluationResult[] = [];

    for (const rule of rules) {
      const startTime = Date.now();
      try {
        const ruleResult = await this.evaluateRule(rule, context, organizationId);
        results.push({
          ...ruleResult,
          executionTime: Date.now() - startTime,
        });
      } catch (error) {
        this.logger.error(
          `Rule evaluation error (${rule.id}): ${error.message}`,
          'RuleEngineService',
        );
      }
    }

    return results;
  }

  async evaluateRule(
    rule: PolicyRule,
    context: EvaluationContext,
    organizationId: string,
  ): Promise<Omit<EvaluationResult, 'executionTime'>> {
    const violations: string[] = [];

    try {
      // Parse conditions
      const conditions = typeof rule.conditions === 'string'
        ? JSON.parse(rule.conditions)
        : rule.conditions;

      // Evaluate conditions
      const conditionResults = this.evaluateConditions(conditions, context.data);

      // If conditions are not met, rule passes
      if (!conditionResults.allMet) {
        await this.recordRuleExecution(rule, false);
        return {
          ruleId: rule.id,
          passed: true,
          violations: [],
        };
      }

      // Conditions met = violation
      const violation = await this.createViolation(
        rule,
        context,
        organizationId,
        conditionResults.failedConditions,
      );

      violations.push(violation.id);

      // Execute rule actions
      if (rule.actions && rule.actions.length > 0) {
        await this.executeActions(rule, violation, organizationId);
      }

      await this.recordRuleExecution(rule, true);

      return {
        ruleId: rule.id,
        passed: false,
        violations,
      };
    } catch (error) {
      this.logger.error(
        `Rule execution failed (${rule.id}): ${error.message}`,
        'RuleEngineService',
      );
      throw error;
    }
  }

  private evaluateConditions(
    conditions: RuleCondition[] | RuleCondition,
    data: Record<string, any>,
  ): { allMet: boolean; failedConditions: RuleCondition[] } {
    const conditionList = Array.isArray(conditions) ? conditions : [conditions];
    const failedConditions: RuleCondition[] = [];

    for (const condition of conditionList) {
      if (!this.evaluateSingleCondition(condition, data)) {
        failedConditions.push(condition);
      }
    }

    return {
      allMet: failedConditions.length === 0,
      failedConditions,
    };
  }

  private evaluateSingleCondition(
    condition: RuleCondition,
    data: Record<string, any>,
  ): boolean {
    const value = this.getNestedValue(data, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'not_contains':
        return !String(value).includes(String(condition.value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'between':
        return (
          Number(value) >= Number(condition.value[0]) &&
          Number(value) <= Number(condition.value[1])
        );
      case 'in':
        return condition.value.includes(value);
      case 'not_in':
        return !condition.value.includes(value);
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      default:
        return true;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  private async createViolation(
    rule: PolicyRule,
    context: EvaluationContext,
    organizationId: string,
    failedConditions: RuleCondition[],
  ): Promise<Violation> {
    const violation = await this.violationRepository.save({
      organizationId,
      policyId: rule.policyId,
      ruleId: rule.id,
      title: `Violation: ${rule.name}`,
      description: rule.description,
      severity: rule.severity,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      ruleContext: {
        failedConditions,
        conditionCount: failedConditions.length,
      },
      evidenceData: context.data,
      requiresReview: rule.severity === 'critical' || rule.severity === 'high',
      metadata: context.metadata || {},
    });

    this.logger.log(
      `Violation created: ${violation.id} (Rule: ${rule.name})`,
      'RuleEngineService',
    );

    return violation;
  }

  private async executeActions(
    rule: PolicyRule,
    violation: Violation,
    organizationId: string,
  ): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'flag_violation':
            // Violation already created and flagged
            break;

          case 'create_alert':
            // Would integrate with alert service
            this.logger.warn(
              `Alert: ${action.params.title || rule.name}`,
              'RuleEngineService',
            );
            break;

          case 'notify_stakeholders':
            // Would send notifications to specified users/roles
            this.logger.info(
              `Notifying stakeholders for violation ${violation.id}`,
              'RuleEngineService',
            );
            break;

          case 'escalate':
            await this.violationRepository.update(
              { id: violation.id },
              { escalationLevel: action.params.level || 1 },
            );
            break;

          case 'block_workflow':
            // Would block associated workflow execution
            this.logger.warn(
              `Blocking workflow for violation ${violation.id}`,
              'RuleEngineService',
            );
            break;

          case 'tag_evidence':
            // Would tag associated evidence
            this.logger.info(
              `Tagging evidence with: ${action.params.tags?.join(', ')}`,
              'RuleEngineService',
            );
            break;

          case 'call_webhook':
            // Would call external webhook
            this.logger.info(
              `Calling webhook: ${action.params.url}`,
              'RuleEngineService',
            );
            break;
        }
      } catch (error) {
        this.logger.error(
          `Action execution failed (${action.type}): ${error.message}`,
          'RuleEngineService',
        );
      }
    }
  }

  private async recordRuleExecution(
    rule: PolicyRule,
    violated: boolean,
  ): Promise<void> {
    const updates: any = {
      executionCount: () => 'execution_count + 1',
      lastExecutedAt: new Date(),
    };

    if (violated) {
      updates.violationCount = () => 'violation_count + 1';
    }

    await this.policyRuleRepository.update({ id: rule.id }, updates);
  }

  async createCustomRule(data: {
    policyId: string;
    organizationId: string;
    name: string;
    description?: string;
    ruleType: string;
    severity: string;
    conditions: any;
    actions: any;
  }): Promise<PolicyRule> {
    const rule = await this.policyRuleRepository.save({
      organizationId: data.organizationId,
      policyId: data.policyId,
      name: data.name,
      description: data.description,
      ruleType: data.ruleType,
      severity: data.severity,
      conditions: typeof data.conditions === 'string'
        ? data.conditions
        : JSON.stringify(data.conditions),
      actions: data.actions,
      isEnabled: true,
    });

    return rule;
  }

  async toggleRule(ruleId: string, enabled: boolean): Promise<PolicyRule> {
    await this.policyRuleRepository.update({ id: ruleId }, { isEnabled: enabled });
    return this.policyRuleRepository.findOne({ where: { id: ruleId } });
  }

  async getRuleStatistics(ruleId: string) {
    const rule = await this.policyRuleRepository.findOne({ where: { id: ruleId } });

    if (!rule) {
      throw new BadRequestException('Rule not found');
    }

    return {
      executionCount: rule.executionCount,
      violationCount: rule.violationCount,
      violationRate: rule.violationRate,
      averageExecutionTime: rule.executionTimeMs,
      lastExecutedAt: rule.lastExecutedAt,
    };
  }
}
