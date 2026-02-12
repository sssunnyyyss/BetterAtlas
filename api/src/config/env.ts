export const env = {
  port: parseInt(process.env.API_PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  
  // Supabase Configuration
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  
  // Legacy: Database URL (for Drizzle migrations if needed)
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://betteratlas:dev_password@localhost:5432/betteratlas",
  
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
} as const;
