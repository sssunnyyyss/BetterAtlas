import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import courseRoutes, { departmentsRouter } from "./routes/courses.js";
import instructorRoutes from "./routes/instructors.js";
import reviewRoutes from "./routes/reviews.js";
import userRoutes from "./routes/users.js";
import socialRoutes from "./routes/social.js";
import scheduleRoutes from "./routes/schedule.js";
import aiRoutes from "./routes/ai.js";
import feedbackRoutes from "./routes/feedback.js";
import programsRoutes from "./routes/programs.js";
import adminProgramsRoutes, { recordAdminAppError } from "./routes/adminPrograms.js";
import aiTrainerRoutes from "./routes/aiTrainer.js";
import inviteCodeRoutes from "./routes/inviteCodes.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { ensureJohnDoe } from "./bootstrap.js";

const app = express();

// Middleware
// Needed for express-rate-limit when requests are proxied (e.g. dev server, reverse proxy).
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(generalLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/departments", departmentsRouter);
app.use("/api/programs", programsRoutes);
app.use("/api/admin", adminProgramsRoutes);
app.use("/api/admin/ai-trainer", aiTrainerRoutes);
app.use("/api/admin/invite-codes", inviteCodeRoutes);
app.use("/api/instructors", instructorRoutes);
app.use("/api", reviewRoutes);
app.use("/api", socialRoutes);
app.use("/api", scheduleRoutes);
app.use("/api", feedbackRoutes);
app.use("/api/users", userRoutes);
app.use("/api", aiRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", auth: "supabase" });
});

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    recordAdminAppError({
      method: req.method,
      path: req.originalUrl || req.path,
      status: 500,
      message: err.message || "Internal server error",
      stack: err.stack || null,
      userId: req.user?.id || null,
    });
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(env.port, () => {
  console.log(`API server running on port ${env.port}`);
  console.log(`Using Supabase at: ${env.supabaseUrl}`);
  ensureJohnDoe().catch((err) =>
    console.error("Failed to bootstrap johndoe user:", err)
  );
});

export default app;
