import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import courseRoutes, { departmentsRouter } from "./routes/courses.js";
import reviewRoutes from "./routes/reviews.js";
import userRoutes from "./routes/users.js";
import socialRoutes from "./routes/social.js";
import { generalLimiter } from "./middleware/rateLimit.js";

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(generalLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/departments", departmentsRouter);
app.use("/api", reviewRoutes);
app.use("/api", socialRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", auth: "supabase" });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(env.port, () => {
  console.log(`API server running on port ${env.port}`);
  console.log(`Using Supabase at: ${env.supabaseUrl}`);
});

export default app;
