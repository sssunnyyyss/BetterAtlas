import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { programCoursesQuerySchema, programsQuerySchema } from "@betteratlas/shared";
import {
  getProgramDetail,
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

