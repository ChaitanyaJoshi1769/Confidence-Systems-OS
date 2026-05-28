import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AIVerificationService } from './services/ai-verification.service';
import { AIVerificationController } from './controllers/ai-verification.controller';

@Module({
  imports: [HttpModule],
  providers: [AIVerificationService],
  controllers: [AIVerificationController],
  exports: [AIVerificationService],
})
export class AIVerificationModule {}
