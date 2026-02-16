import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { programCoursesQuerySchema, programsQuerySchema } from "@betteratlas/shared";
import {
  getProgramDetail,
  getProgramAiRequirementsSummary,
  getProgramVariants,
  listProgramCourses,
  listPrograms,
} from "../services/programService.js";

const router = Router();

router.get("/", validate(programsQuerySchema, "query"), async (req, res) => {
  const result = await listPrograms((req as any).validatedQuery);
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid program ID" });

  const program = await getProgramDetail(id);
  if (!program) return res.status(404).json({ error: "Program not found" });
  res.json(program);
});

router.get("/:id/variants", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid program ID" });

  const v = await getProgramVariants(id);
  if (!v) return res.status(404).json({ error: "Program not found" });
  res.json(v);
});

router.get("/:id/ai-summary", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid program ID" });

  const refresh = req.query.refresh === "1" || req.query.refresh === "true";

  try {
    const s = await getProgramAiRequirementsSummary(id, { refresh });
    if (!s) return res.status(404).json({ error: "Program not found" });
    res.json(s);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to generate summary" });
  }
});

router.get(
  "/:id/courses",
  validate(programCoursesQuerySchema, "query"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid program ID" });

    const result = await listProgramCourses(id, (req as any).validatedQuery);
    res.json(result);
  }
);

export default router;
