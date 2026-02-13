import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { terms } from "../db/schema.js";

export async function resolveTermCode(termNameOrCode: string): Promise<string> {
  const value = termNameOrCode.trim();
  if (!value) throw new Error("term is required");

  // Accept either a srcdb code (e.g. 5261) or a display name (e.g. Spring 2026).
  if (/^[0-9]{4}$/.test(value)) {
    const [t] = await db
      .select({ srcdb: terms.srcdb })
      .from(terms)
      .where(eq(terms.srcdb, value))
      .limit(1);
    if (t) return t.srcdb;
  } else {
    const [t] = await db
      .select({ srcdb: terms.srcdb })
      .from(terms)
      .where(eq(terms.name, value))
      .limit(1);
    if (t) return t.srcdb;
  }

  throw new Error(`Unknown term: ${termNameOrCode}`);
}

