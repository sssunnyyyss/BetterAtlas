import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { courseQuerySchema, searchQuerySchema } from "@betteratlas/shared";
import {
  listCourses,
  searchCourses,
  getCourseById,
  listDepartments,
} from "../services/courseService.js";

const router = Router();

router.get("/", validate(courseQuerySchema, "query"), async (req, res) => {
  const result = await listCourses((req as any).validatedQuery);
  res.json(result);
});

router.get("/search", validate(searchQuerySchema, "query"), async (req, res) => {
  const result = await searchCourses((req as any).validatedQuery);
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid course ID" });
  }
  const course = await getCourseById(id);
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }
  res.json(course);
});

// Departments endpoint (under /api/departments)
export const departmentsRouter = Router();
departmentsRouter.get("/", async (_req, res) => {
  const deps = await listDepartments();
  res.json(deps);
});

export default router;
