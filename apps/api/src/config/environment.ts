export const environment = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  webUrl: process.env.WEB_URL || 'http://localhost:3001',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'confidence_systems',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    ssl: process.env.DB_SSL === 'true',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    username: process.env.REDIS_USERNAME,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET || 'confidence-systems-evidence',
    s3Endpoint: process.env.AWS_S3_ENDPOINT,
  },

  // Kafka
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'confidence-api',
    groupId: process.env.KAFKA_GROUP_ID || 'confidence-api-group',
  },

  // OpenAI / LLM
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    modelName: process.env.AI_MODEL_NAME || 'gpt-4',
  },

  // OpenSearch
  openSearch: {
    node: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
    username: process.env.OPENSEARCH_USERNAME,
    password: process.env.OPENSEARCH_PASSWORD,
  },

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001').split(','),

  // Authentication
  auth: {
    saltRounds: parseInt(process.env.AUTH_SALT_ROUNDS || '10', 10),
    mfaEnabled: process.env.MFA_ENABLED === 'true',
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60', 10),
  },

  // Observability
  observability: {
    tracingEnabled: process.env.TRACING_ENABLED === 'true',
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    prometheusEnabled: process.env.PROMETHEUS_ENABLED === 'true',
  },

  // Feature Flags
  features: {
    aiVerificationEnabled: process.env.AI_VERIFICATION_ENABLED === 'true',
    complianceAutomationEnabled: process.env.COMPLIANCE_AUTOMATION_ENABLED === 'true',
    anomalyDetectionEnabled: process.env.ANOMALY_DETECTION_ENABLED === 'true',
  },

  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@confidence.systems',
    sendGridApiKey: process.env.SENDGRID_API_KEY,
  },

  // Pagination
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
  },
};
