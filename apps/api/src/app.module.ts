import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { environment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { OperationsModule } from './modules/operations/operations.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { ObservabilityModule } from '@observability/observability.module';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [() => environment],
    }),

    // Cache
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: environment.redis.host,
      port: environment.redis.port,
      ttl: 300, // 5 minutes default
    }),

    // Database
    DatabaseModule,

    // Observability (Logging, Tracing, Metrics)
    ObservabilityModule,

    // Scheduling
    ScheduleModule.forRoot(),

    // Authentication & Authorization
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: environment.jwt.secret,
      signOptions: { expiresIn: environment.jwt.expiresIn },
      global: true,
    }),
    AuthModule,

    // Feature Modules
    WorkflowModule,
    EvidenceModule,
    ComplianceModule,
    OperationsModule,
    IntegrationModule,
  ],
  providers: [],
})
export class AppModule {}
