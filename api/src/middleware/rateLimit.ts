import rateLimit from "express-rate-limit";

// Effectively disable throttling without turning middleware off entirely.
const EFFECTIVELY_UNLIMITED_MAX = 1_000_000;

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: EFFECTIVELY_UNLIMITED_MAX,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: EFFECTIVELY_UNLIMITED_MAX,
  message: { error: "Too many auth attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: EFFECTIVELY_UNLIMITED_MAX,
  message: { error: "Too many review submissions, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: EFFECTIVELY_UNLIMITED_MAX,
  message: { error: "Too many AI requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const oauthTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: EFFECTIVELY_UNLIMITED_MAX,
  message: { error: "Too many token requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const feedbackHubWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: EFFECTIVELY_UNLIMITED_MAX,
  message: { error: "Too many feedback actions, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
