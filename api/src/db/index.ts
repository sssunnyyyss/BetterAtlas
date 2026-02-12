import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

// Supabase client for auth and realtime features
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Supabase client with anon key (for verifying user tokens)
export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Drizzle ORM client for database queries
// Uses Supabase's PostgreSQL connection
const client = postgres(env.databaseUrl, { prepare: false });
export const db = drizzle(client, { schema });
