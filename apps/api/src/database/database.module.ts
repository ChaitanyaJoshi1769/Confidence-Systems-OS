import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { environment } from '../config/environment';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: environment.database.host,
      port: environment.database.port,
      username: environment.database.username,
      password: environment.database.password,
      database: environment.database.database,
      entities: ['src/**/*.entity.ts'],
      migrations: ['src/database/migrations/*.ts'],
      subscribers: ['src/database/subscribers/*.ts'],
      synchronize: environment.database.synchronize,
      logging: environment.database.logging,
      ssl: environment.database.ssl ? { rejectUnauthorized: false } : false,
      maxQueryExecutionTime: 30000,
      connectTimeoutMS: 10000,
      poolSize: environment.database.maxConnections,
      extra: {
        max: environment.database.maxConnections,
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
      // Schema setup
      schemaSync: false,
      multipleStatements: false,
      supportBigNumbers: true,
      bigNumberStrings: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {
  constructor(private dataSource: DataSource) {
    this.initialize();
  }

  private async initialize() {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }
}
