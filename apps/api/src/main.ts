import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { environment } from './config/environment';
import { LoggerService } from '@observability/logger.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Setup logger
  const loggerService = app.get(LoggerService);
  app.useLogger(loggerService);

  // CORS
  app.enableCors({
    origin: environment.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });

  // Request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors
          .map((error) => ({
            field: error.property,
            message: Object.values(error.constraints || {}).join(', '),
          }));
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: messages,
        });
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter(loggerService));

  // Swagger documentation
  if (environment.nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Confidence Systems OS API')
      .setDescription('Enterprise AI-native Operational Intelligence Platform')
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access_token',
      )
      .addServer(`http://localhost:${environment.port}`, 'Local')
      .addServer('https://api.confidence.systems', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Health check endpoint
  app.get('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  await app.listen(environment.port, environment.host);
  loggerService.log(
    `🚀 Confidence Systems OS API running on http://${environment.host}:${environment.port}`,
    'Bootstrap',
  );
  loggerService.log(
    `📚 API Documentation available at http://${environment.host}:${environment.port}/api/docs`,
    'Bootstrap',
  );
}

bootstrap().catch((error) => {
  console.error('❌ Failed to bootstrap application:', error);
  process.exit(1);
});
