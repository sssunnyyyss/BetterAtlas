import express from "express";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import RedisStore from "connect-redis";
import Redis from "ioredis";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import courseRoutes, { departmentsRouter } from "./routes/courses.js";
import reviewRoutes from "./routes/reviews.js";
import userRoutes from "./routes/users.js";
import socialRoutes from "./routes/social.js";
import { generalLimiter } from "./middleware/rateLimit.js";

const app = express();

// Redis client
const redis = new Redis(env.redisUrl);

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

// Session
app.use(
  session({
    store: new RedisStore({ client: redis }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.nodeEnv === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    },
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/departments", departmentsRouter);
app.use("/api", reviewRoutes);
app.use("/api", socialRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
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
});

export default app;
