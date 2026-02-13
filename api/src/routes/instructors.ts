import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { instructorQuerySchema } from "@betteratlas/shared";
import { db } from "../db/index.js";
import { instructors } from "../db/schema.js";
import { asc, ilike } from "drizzle-orm";

const router = Router();

// GET /api/instructors?q=...&limit=...
router.get("/", validate(instructorQuerySchema, "query"), async (req, res) => {
  const { q, limit } = (req as any).validatedQuery as {
    q?: string;
    limit: number;
  };

  const base = db
    .select({
      id: instructors.id,
      name: instructors.name,
      email: instructors.email,
      departmentId: instructors.departmentId,
    })
    .from(instructors);

  const filtered = q
    ? base.where(ilike(instructors.name, `%${q}%`))
    : base;

  const rows = await filtered.orderBy(asc(instructors.name)).limit(limit);
  res.json(rows);
});

export default router;

