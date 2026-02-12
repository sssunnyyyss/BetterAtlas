export const env = {
  port: parseInt(process.env.API_PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://betteratlas:dev_password@localhost:5432/betteratlas",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  sessionSecret: process.env.SESSION_SECRET || "dev_secret",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
} as const;
