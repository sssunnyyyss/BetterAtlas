import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const migrationPath = path.resolve(__dirname, "../../../schema-migration.sql");
  const migrationSql = await fs.readFile(migrationPath, "utf8");

  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(env.databaseUrl, { prepare: false, max: 1 });

  try {
    const rows = await sql`
      select
        current_database() as current_database,
        current_user as current_user,
        inet_server_addr()::text as server_addr,
        inet_server_port() as server_port,
        now()::text as now
    `;
    const info = (rows[0] ?? {}) as {
      current_database?: string;
      current_user?: string;
      server_addr?: string | null;
      server_port?: number | null;
      now?: string;
    };

    console.log(
      `[schema-migration] connected database=${info.current_database ?? "?"} user=${info.current_user ?? "?"} server=${info.server_addr ?? "?"}:${info.server_port ?? "?"} now=${info.now ?? "?"}`
    );

    // The migration file contains BEGIN/COMMIT and multiple statements, so we must use "simple" protocol.
    const q: any = sql.unsafe(migrationSql);
    if (typeof q.simple === "function") {
      await q.simple();
    } else {
      // Fallback: this will likely fail on multi-statement scripts, but keeps the error readable.
      await q;
    }

    console.log("[schema-migration] applied successfully");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("[schema-migration] failed:", e);
  process.exitCode = 1;
});
