import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from './entities/policy.entity';
import { PolicyRule } from './entities/policy-rule.entity';
import { Violation } from './entities/violation.entity';
import { Certification } from './entities/certification.entity';
import { PolicyService } from './services/policy.service';
import { RuleEngineService } from './services/rule-engine.service';
import { ViolationService } from './services/violation.service';
import { CertificationService } from './services/certification.service';
import { ComplianceController } from './controllers/compliance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Policy,
      PolicyRule,
      Violation,
      Certification,
    ]),
  ],
  providers: [
    PolicyService,
    RuleEngineService,
    ViolationService,
    CertificationService,
  ],
  controllers: [ComplianceController],
  exports: [
    PolicyService,
    RuleEngineService,
    ViolationService,
    CertificationService,
  ],
})
export class ComplianceModule {}
