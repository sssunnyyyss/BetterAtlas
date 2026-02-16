import { Router, type Request, type Response, type NextFunction } from "express";
import os from "node:os";
import { statfs } from "node:fs/promises";
import { env } from "../config/env.js";
import { syncPrograms } from "../jobs/programsSync.js";
import { requireAuth } from "../middleware/auth.js";
import { isAdminEmail } from "../utils/admin.js";
import { db, supabase } from "../db/index.js";
import { courses, friendships, programs, reviews, sections, users } from "../db/schema.js";
import { desc, eq, gte, ilike, or, sql } from "drizzle-orm";

const router = Router();

type ProgramsSyncStats = {
  fetchedPrograms: number;
  upsertedPrograms: number;
  updatedRequirements: number;
  skippedUnchanged: number;
  errors: Array<{ sourceUrl: string; error: string }>;
};

type RunStatus = "queued" | "running" | "succeeded" | "failed";

type SyncRunLog = {
  id: number;
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
};

type SyncRun = {
  id: number;
  type: "programs_sync";
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string;
  requestedEmail: string;
  stats: ProgramsSyncStats | null;
  error: string | null;
  logs: SyncRunLog[];
};

type AdminAppError = {
  id: number;
  ts: string;
  method: string;
  path: string;
  status: number;
  message: string;
  stack: string | null;
  userId: string | null;
};

const MAX_RUNS = 100;
const MAX_LOGS_PER_RUN = 1000;
const MAX_APP_ERRORS = 500;
const BAN_DURATION = "876000h";

const syncRuns: SyncRun[] = [];
const appErrors: AdminAppError[] = [];
let nextRunId = 1;
let nextRunLogId = 1;
let nextAppErrorId = 1;

function nowIso() {
  return new Date().toISOString();
}

function summarizeRun(run: SyncRun) {
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    requestedBy: run.requestedBy,
    requestedEmail: run.requestedEmail,
    stats: run.stats,
    error: run.error,
    logCount: run.logs.length,
  };
}

function getRunningSyncRun() {
  return syncRuns.find((run) => run.status === "queued" || run.status === "running") || null;
}

function findRunById(rawId: string) {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id)) return null;
  return syncRuns.find((run) => run.id === id) || null;
}

function pushRunLog(run: SyncRun, level: SyncRunLog["level"], message: string) {
  run.logs.push({
    id: nextRunLogId++,
    ts: nowIso(),
    level,
    message,
  });
  if (run.logs.length > MAX_LOGS_PER_RUN) {
    run.logs.splice(0, run.logs.length - MAX_LOGS_PER_RUN);
  }
}

function createSyncRun(requestedBy: string, requestedEmail: string) {
  const run: SyncRun = {
    id: nextRunId++,
    type: "programs_sync",
    status: "queued",
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    requestedBy,
    requestedEmail,
    stats: null,
    error: null,
    logs: [],
  };
  syncRuns.unshift(run);
  if (syncRuns.length > MAX_RUNS) {
    syncRuns.splice(MAX_RUNS);
  }
  return run;
}

async function executeSyncRun(run: SyncRun) {
  run.status = "running";
  run.startedAt = nowIso();
  pushRunLog(run, "info", "Programs sync started");
  try {
    const stats = await syncPrograms();
    run.stats = stats;
    run.status = "succeeded";
    run.finishedAt = nowIso();
    pushRunLog(
      run,
      "info",
      `Sync complete. fetched=${stats.fetchedPrograms} upserted=${stats.upsertedPrograms} updated=${stats.updatedRequirements} unchanged=${stats.skippedUnchanged} errors=${stats.errors.length}`
    );
    if (stats.errors.length > 0) {
      for (const err of stats.errors.slice(0, 20)) {
        pushRunLog(run, "warn", `${err.sourceUrl}: ${err.error}`);
      }
    }
  } catch (err: any) {
    run.status = "failed";
    run.finishedAt = nowIso();
    const message = err?.message || String(err);
    run.error = message;
    pushRunLog(run, "error", message);
  }
}

function requireSyncSecret(req: Request, res: Response, next: NextFunction) {
  const want = env.programsSyncSecret;
  if (!want) return res.status(500).json({ error: "Sync secret not configured" });

  const got = String(req.headers["x-programs-sync-secret"] || "");
  if (got !== want) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

async function measureDbHealth() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

async function measureDisk() {
  try {
    const stats = await statfs(env.metricsDiskPath);
    const blockSize = Number(stats.bsize);
    const blocks = Number(stats.blocks);
    const availableBlocks = Number(stats.bavail);
    const totalBytes = blockSize * blocks;
    const freeBytes = blockSize * availableBlocks;
    const usedBytes = Math.max(totalBytes - freeBytes, 0);
    return {
      path: env.metricsDiskPath,
      totalBytes,
      usedBytes,
      freeBytes,
      usagePct: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
    };
  } catch {
    return null;
  }
}

export function recordAdminAppError(error: {
  method: string;
  path: string;
  status: number;
  message: string;
  stack?: string | null;
  userId?: string | null;
}) {
  appErrors.unshift({
    id: nextAppErrorId++,
    ts: nowIso(),
    method: error.method,
    path: error.path,
    status: error.status,
    message: error.message,
    stack: error.stack || null,
    userId: error.userId || null,
  });
  if (appErrors.length > MAX_APP_ERRORS) {
    appErrors.splice(MAX_APP_ERRORS);
  }
}

// Compatibility endpoint for server-side secret-based triggers.
router.post("/programs/sync", requireSyncSecret, async (_req, res) => {
  const stats = await syncPrograms();
  res.json(stats);
});

router.use(requireAuth, requireAdmin);

// Compatibility endpoint used by existing profile admin tools.
router.post("/programs/sync/me", async (_req, res) => {
  const stats = await syncPrograms();
  res.json(stats);
});

// Start async programs sync run.
router.post("/sync/runs", async (req, res) => {
  const running = getRunningSyncRun();
  if (running) {
    return res.status(409).json({
      error: "A programs sync run is already in progress",
      run: summarizeRun(running),
    });
  }

  const run = createSyncRun(req.user!.id, req.user!.email);
  queueMicrotask(() => {
    void executeSyncRun(run);
  });

  res.status(202).json(summarizeRun(run));
});

router.get("/sync/runs", async (_req, res) => {
  res.json(syncRuns.map(summarizeRun));
});

router.get("/sync/runs/:id", async (req, res) => {
  const run = findRunById(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(summarizeRun(run));
});

router.get("/sync/runs/:id/logs", async (req, res) => {
  const run = findRunById(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });

  const afterIdRaw = String(req.query.afterId || "0");
  const afterId = Number.parseInt(afterIdRaw, 10);
  const logs = Number.isFinite(afterId)
    ? run.logs.filter((log) => log.id > afterId)
    : run.logs;

  res.json(logs);
});

router.get("/system/metrics", async (_req, res) => {
  const dbHealth = await measureDbHealth();
  const disk = await measureDisk();
  const loadAvg = os.loadavg();
  const memory = process.memoryUsage();

  res.json({
    ts: nowIso(),
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      uptimeSec: os.uptime(),
      cpuCount: os.cpus().length,
      loadAvg1m: loadAvg[0] ?? 0,
      loadAvg5m: loadAvg[1] ?? 0,
      loadAvg15m: loadAvg[2] ?? 0,
    },
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      processRssBytes: memory.rss,
      processHeapUsedBytes: memory.heapUsed,
      processHeapTotalBytes: memory.heapTotal,
    },
    disk,
    db: dbHealth,
    app: {
      nodeEnv: env.nodeEnv,
      version: process.env.npm_package_version || "unknown",
      pid: process.pid,
      uptimeSec: process.uptime(),
    },
  });
});

router.get("/stats/overview", async (req, res) => {
  const windowDaysRaw = String(req.query.windowDays || "7");
  const parsedWindowDays = Number.parseInt(windowDaysRaw, 10);
  const windowDays = Number.isFinite(parsedWindowDays)
    ? Math.min(Math.max(parsedWindowDays, 1), 365)
    : 7;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [usersTotalRow, usersNewRow, reviewsTotalRow, reviewsNewRow, coursesRow, sectionsRow, programsRow, pendingFriendshipsRow, acceptedFriendshipsRow] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, since)),
    db.select({ count: sql<number>`count(*)` }).from(reviews),
    db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(gte(reviews.createdAt, since)),
    db.select({ count: sql<number>`count(*)` }).from(courses),
    db
      .select({ count: sql<number>`count(*)` })
      .from(sections)
      .where(eq(sections.isActive, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(programs)
      .where(eq(programs.isActive, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(friendships)
      .where(eq(friendships.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(friendships)
      .where(eq(friendships.status, "accepted")),
  ]);

  const latestSucceededRun =
    syncRuns.find((run) => run.status === "succeeded") || null;

  res.json({
    windowDays,
    users: {
      total: usersTotalRow[0]?.count ?? 0,
      newInWindow: usersNewRow[0]?.count ?? 0,
    },
    reviews: {
      total: reviewsTotalRow[0]?.count ?? 0,
      newInWindow: reviewsNewRow[0]?.count ?? 0,
    },
    catalog: {
      courses: coursesRow[0]?.count ?? 0,
      activeSections: sectionsRow[0]?.count ?? 0,
      activePrograms: programsRow[0]?.count ?? 0,
      lastSuccessfulProgramsSyncAt: latestSucceededRun?.finishedAt || null,
    },
    social: {
      pendingFriendships: pendingFriendshipsRow[0]?.count ?? 0,
      acceptedFriendships: acceptedFriendshipsRow[0]?.count ?? 0,
    },
  });
});

router.get("/users", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limitRaw = String(req.query.limit || "50");
  const limit = Math.min(Math.max(Number.parseInt(limitRaw, 10) || 50, 1), 200);

  const base = db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      fullName: users.displayName,
      graduationYear: users.graduationYear,
      major: users.major,
      createdAt: users.createdAt,
    })
    .from(users);

  const rows = q
    ? await base
        .where(
          or(
            ilike(users.email, `%${q}%`),
            ilike(users.username, `%${q}%`),
            ilike(users.displayName, `%${q}%`)
          )
        )
        .orderBy(desc(users.createdAt))
        .limit(limit)
    : await base.orderBy(desc(users.createdAt)).limit(limit);

  res.json(
    rows.map((row) => ({
      ...row,
      isAdmin: isAdminEmail(row.email),
    }))
  );
});

router.post("/users", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const fullName = String(req.body?.fullName || "").trim();
  const rawUsername = String(req.body?.username || "").trim().toLowerCase();
  const username = rawUsername.replace(/^@/, "");
  const graduationYear =
    typeof req.body?.graduationYear === "number" ? req.body.graduationYear : null;
  const major =
    typeof req.body?.major === "string" && req.body.major.trim()
      ? req.body.major.trim()
      : null;

  if (!email || !password || !fullName || !username) {
    return res.status(400).json({ error: "email, password, fullName, and username are required" });
  }

  const [usernameTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (usernameTaken) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const { data: createdAuth, error: createAuthError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: fullName,
    },
  });

  if (createAuthError || !createdAuth.user) {
    return res.status(400).json({ error: createAuthError?.message || "Failed to create auth user" });
  }

  const [createdUser] = await db
    .insert(users)
    .values({
      id: createdAuth.user.id,
      email,
      username,
      displayName: fullName,
      graduationYear,
      major,
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      fullName: users.displayName,
      graduationYear: users.graduationYear,
      major: users.major,
      createdAt: users.createdAt,
    });

  res.status(201).json({
    ...createdUser,
    isAdmin: isAdminEmail(createdUser.email),
  });
});

router.post("/users/:id/ban", async (req, res) => {
  const userId = String(req.params.id || "");
  const banned = Boolean(req.body?.banned);

  if (!userId) return res.status(400).json({ error: "User id is required" });
  if (userId === req.user!.id) {
    return res.status(400).json({ error: "You cannot change ban status on your own account" });
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banned ? BAN_DURATION : "none",
  });

  if (error) {
    return res.status(400).json({ error: error.message || "Failed to update user access" });
  }

  res.json({ ok: true, userId, banned });
});

router.delete("/users/:id", async (req, res) => {
  const userId = String(req.params.id || "");
  if (!userId) return res.status(400).json({ error: "User id is required" });
  if (userId === req.user!.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return res.status(400).json({ error: authDeleteError.message || "Failed to delete auth user" });
  }

  // Keep relational integrity: try to delete profile row, and if blocked by FKs,
  // anonymize the profile so account data can no longer be used to log in.
  let profileDeleted = false;
  try {
    await db.delete(users).where(eq(users.id, userId));
    profileDeleted = true;
  } catch {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existing) {
      const suffix = userId.replace(/-/g, "").slice(0, 12);
      await db
        .update(users)
        .set({
          email: `deleted-${suffix}@invalid.local`,
          username: `deleted_${suffix}`.slice(0, 30),
          displayName: "Deleted User",
        })
        .where(eq(users.id, userId));
    }
  }

  res.json({ ok: true, userId, profileDeleted });
});

router.get("/logs", async (_req, res) => {
  const recentRuns = syncRuns.slice(0, 20).map((run) => ({
    ...summarizeRun(run),
    latestLogs: run.logs.slice(-20),
  }));

  res.json({
    appErrors: appErrors.slice(0, 200),
    recentRuns,
  });
});

export default router;

