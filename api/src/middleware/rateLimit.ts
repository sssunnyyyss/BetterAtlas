import rateLimit from "express-rate-limit";

const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // In dev (Docker, HMR, React Query retries), you can easily exceed 100 requests.
  // Keep production strict, but make dev effectively unlimited.
  max: isDev ? 10_000 : 100,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 20,
  message: { error: "Too many auth attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // AI calls are expensive; keep tighter in prod.
  max: isDev ? 1_000 : 30,
  message: { error: "Too many AI requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
