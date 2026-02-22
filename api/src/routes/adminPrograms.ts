import { Router, type Request, type Response, type NextFunction } from "express";
import os from "node:os";
import { statfs } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { syncPrograms } from "../jobs/programsSync.js";
import { requireAuth } from "../middleware/auth.js";
import { isAdminEmail } from "../utils/admin.js";
import { db, supabase } from "../db/index.js";
import { courses, friendships, programs, reviews, sections, terms, users } from "../db/schema.js";
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

type CourseSyncRun = {
  id: number;
  type: "courses_sync";
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string;
  requestedEmail: string;
  termCode: string | null;
  termCodes: string[];
  scheduleTriggered: boolean;
  error: string | null;
  logs: SyncRunLog[];
};

type EmbeddingSyncRun = {
  id: number;
  type: "embeddings_sync";
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string;
  requestedEmail: string;
  error: string | null;
  logs: SyncRunLog[];
};

type RmpSyncRun = {
  id: number;
  type: "rmp_sync";
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string;
  requestedEmail: string;
  onlyInstructorIds: number[];
  onlyTeacherIds: string[];
  error: string | null;
  logs: SyncRunLog[];
};

type CourseSyncSchedule = {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  termCode: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

const MAX_RUNS = 100;
const MAX_LOGS_PER_RUN = 1000;
const MAX_APP_ERRORS = 500;
const BAN_DURATION = "876000h";
const DEFAULT_COURSE_SCHEDULE_TIMEZONE = "America/New_York";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRootDir = path.resolve(__dirname, "../..");
const atlasSyncDistPath = path.resolve(apiRootDir, "dist/jobs/atlasSync.js");
const embeddingsBackfillDistPath = path.resolve(
  apiRootDir,
  "dist/jobs/courseEmbeddingsBackfill.js"
);
const rmpSeedDistPath = path.resolve(apiRootDir, "dist/jobs/rmpSeed.js");

const syncRuns: SyncRun[] = [];
const courseSyncRuns: CourseSyncRun[] = [];
const embeddingSyncRuns: EmbeddingSyncRun[] = [];
const rmpSyncRuns: RmpSyncRun[] = [];
const appErrors: AdminAppError[] = [];
let nextRunId = 1;
let nextRunLogId = 1;
let nextAppErrorId = 1;

let courseSyncSchedule: CourseSyncSchedule = {
  enabled: false,
  hour: 3,
  minute: 0,
  timezone: DEFAULT_COURSE_SCHEDULE_TIMEZONE,
  termCode: null,
  updatedBy: null,
  updatedAt: nowIso(),
};
let courseScheduleLoaded = false;
let courseScheduleInitStarted = false;
let courseScheduleLastTriggerKey: string | null = null;

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

function pushRunLog(
  run: { logs: SyncRunLog[] },
  level: SyncRunLog["level"],
  message: string
) {
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

function summarizeCourseSyncRun(run: CourseSyncRun) {
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    requestedBy: run.requestedBy,
    requestedEmail: run.requestedEmail,
    termCode: run.termCode,
    termCodes: run.termCodes,
    scheduleTriggered: run.scheduleTriggered,
    error: run.error,
    logCount: run.logs.length,
  };
}

function summarizeEmbeddingSyncRun(run: EmbeddingSyncRun) {
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    requestedBy: run.requestedBy,
    requestedEmail: run.requestedEmail,
    error: run.error,
    logCount: run.logs.length,
  };
}

function summarizeRmpSyncRun(run: RmpSyncRun) {
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    requestedBy: run.requestedBy,
    requestedEmail: run.requestedEmail,
    onlyInstructorIds: run.onlyInstructorIds,
    onlyTeacherIds: run.onlyTeacherIds,
    error: run.error,
    logCount: run.logs.length,
  };
}

function getRunningCourseSyncRun() {
  return (
    courseSyncRuns.find((run) => run.status === "queued" || run.status === "running") || null
  );
}

function getRunningEmbeddingSyncRun() {
  return (
    embeddingSyncRuns.find((run) => run.status === "queued" || run.status === "running") || null
  );
}

function getRunningRmpSyncRun() {
  return rmpSyncRuns.find((run) => run.status === "queued" || run.status === "running") || null;
}

function findCourseSyncRunById(rawId: string) {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id)) return null;
  return courseSyncRuns.find((run) => run.id === id) || null;
}

function findEmbeddingSyncRunById(rawId: string) {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id)) return null;
  return embeddingSyncRuns.find((run) => run.id === id) || null;
}

function findRmpSyncRunById(rawId: string) {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id)) return null;
  return rmpSyncRuns.find((run) => run.id === id) || null;
}

function createCourseSyncRun(input: {
  requestedBy: string;
  requestedEmail: string;
  termCodes: string[];
  scheduleTriggered: boolean;
}) {
  const cleanedTermCodes = Array.from(
    new Set(
      input.termCodes
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );
  const run: CourseSyncRun = {
    id: nextRunId++,
    type: "courses_sync",
    status: "queued",
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    requestedBy: input.requestedBy,
    requestedEmail: input.requestedEmail,
    termCode: cleanedTermCodes.length === 1 ? cleanedTermCodes[0]! : null,
    termCodes: cleanedTermCodes,
    scheduleTriggered: input.scheduleTriggered,
    error: null,
    logs: [],
  };
  courseSyncRuns.unshift(run);
  if (courseSyncRuns.length > MAX_RUNS) {
    courseSyncRuns.splice(MAX_RUNS);
  }
  return run;
}

function createEmbeddingSyncRun(input: { requestedBy: string; requestedEmail: string }) {
  const run: EmbeddingSyncRun = {
    id: nextRunId++,
    type: "embeddings_sync",
    status: "queued",
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    requestedBy: input.requestedBy,
    requestedEmail: input.requestedEmail,
    error: null,
    logs: [],
  };
  embeddingSyncRuns.unshift(run);
  if (embeddingSyncRuns.length > MAX_RUNS) {
    embeddingSyncRuns.splice(MAX_RUNS);
  }
  return run;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeIntList(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const out = new Set<number>();
  for (const value of values) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (Number.isFinite(parsed)) out.add(parsed);
  }
  return Array.from(out);
}

function createRmpSyncRun(input: {
  requestedBy: string;
  requestedEmail: string;
  onlyInstructorIds: number[];
  onlyTeacherIds: string[];
}) {
  const run: RmpSyncRun = {
    id: nextRunId++,
    type: "rmp_sync",
    status: "queued",
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    requestedBy: input.requestedBy,
    requestedEmail: input.requestedEmail,
    onlyInstructorIds: Array.from(new Set(input.onlyInstructorIds)),
    onlyTeacherIds: Array.from(new Set(input.onlyTeacherIds)),
    error: null,
    logs: [],
  };
  rmpSyncRuns.unshift(run);
  if (rmpSyncRuns.length > MAX_RUNS) {
    rmpSyncRuns.splice(MAX_RUNS);
  }
  return run;
}

function inferSeasonFromTermCode(termCode: string): string {
  const code = termCode.trim();
  const seasonCode = code.slice(-1);
  if (seasonCode === "1") return "Spring";
  if (seasonCode === "6") return "Summer";
  if (seasonCode === "9") return "Fall";
  if (seasonCode === "4") return "Winter";
  return "Unknown";
}

function inferYearFromTermCode(termCode: string): number {
  const code = termCode.trim();
  if (code.length >= 3) {
    const yy = Number.parseInt(code.slice(1, 3), 10);
    if (Number.isFinite(yy)) {
      return 2000 + yy;
    }
  }
  return new Date().getFullYear();
}

function inferTermName(termCode: string, season: string, year: number): string {
  if (season === "Unknown") return `Term ${termCode}`;
  return `${season} ${year}`;
}

async function ensureTermExists(termCodeInput: string) {
  const termCode = termCodeInput.trim();
  if (!termCode) return null;

  const [existing] = await db
    .select({
      srcdb: terms.srcdb,
      name: terms.name,
      season: terms.season,
      year: terms.year,
      isActive: terms.isActive,
    })
    .from(terms)
    .where(eq(terms.srcdb, termCode))
    .limit(1);

  if (existing) return existing;

  const season = inferSeasonFromTermCode(termCode);
  const year = inferYearFromTermCode(termCode);
  const name = inferTermName(termCode, season, year);

  const [inserted] = await db
    .insert(terms)
    .values({
      srcdb: termCode,
      name,
      season,
      year,
      isActive: false,
    })
    .onConflictDoNothing()
    .returning({
      srcdb: terms.srcdb,
      name: terms.name,
      season: terms.season,
      year: terms.year,
      isActive: terms.isActive,
    });

  if (inserted) return inserted;

  const [reloaded] = await db
    .select({
      srcdb: terms.srcdb,
      name: terms.name,
      season: terms.season,
      year: terms.year,
      isActive: terms.isActive,
    })
    .from(terms)
    .where(eq(terms.srcdb, termCode))
    .limit(1);

  return reloaded || null;
}

function isValidTimezone(tz: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function timePartsForZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const year = lookup("year");
  const month = lookup("month");
  const day = lookup("day");
  const hour = Number.parseInt(lookup("hour"), 10);
  const minute = Number.parseInt(lookup("minute"), 10);
  return {
    year,
    month,
    day,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function lineSplitPump(
  run: { logs: SyncRunLog[] },
  level: SyncRunLog["level"],
  chunk: string,
  buffer: { value: string },
  prefix?: string
) {
  buffer.value += chunk;
  const lines = buffer.value.split(/\r?\n/);
  buffer.value = lines.pop() ?? "";
  for (const line of lines) {
    const message = line.trim();
    if (message) pushRunLog(run, level, `${prefix ?? ""}${message}`);
  }
}

async function executeCourseSyncRun(run: CourseSyncRun) {
  const executeSingleCourseSyncProcess = async (
    termCode: string | null,
    label: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const envVars: NodeJS.ProcessEnv = { ...process.env };
    if (termCode) envVars.ATLAS_TERM_CODE = termCode;
    else delete envVars.ATLAS_TERM_CODE;

    const useDistScript = existsSync(atlasSyncDistPath);
    const command = useDistScript ? process.execPath : "pnpm";
    const args = useDistScript ? [atlasSyncDistPath] : ["atlas:sync"];

    pushRunLog(
      run,
      "info",
      `[${label}] Launching ${useDistScript ? `node ${atlasSyncDistPath}` : "pnpm atlas:sync"}`
    );

    const child = spawn(command, args, {
      cwd: apiRootDir,
      env: envVars,
      shell: !useDistScript && process.platform === "win32",
    });

    const stdoutBuffer = { value: "" };
    const stderrBuffer = { value: "" };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      lineSplitPump(run, "info", chunk, stdoutBuffer, `[${label}] `);
    });
    child.stderr?.on("data", (chunk: string) => {
      lineSplitPump(run, "warn", chunk, stderrBuffer, `[${label}] `);
    });

    return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      child.on("error", (err) => {
        const message = err.message || "Failed to launch course sync process";
        pushRunLog(run, "error", `[${label}] ${message}`);
        resolve({ ok: false, error: message });
      });

      child.on("close", (code, signal) => {
        if (stdoutBuffer.value.trim()) {
          pushRunLog(run, "info", `[${label}] ${stdoutBuffer.value.trim()}`);
        }
        if (stderrBuffer.value.trim()) {
          pushRunLog(run, "warn", `[${label}] ${stderrBuffer.value.trim()}`);
        }

        if (code === 0) {
          resolve({ ok: true });
        } else {
          const message = `Course sync exited with code=${code ?? "null"} signal=${signal ?? "null"}`;
          pushRunLog(run, "error", `[${label}] ${message}`);
          resolve({ ok: false, error: message });
        }
      });
    });
  };

  run.status = "running";
  run.startedAt = nowIso();
  const termsToRun = run.termCodes.length > 0 ? run.termCodes : [null];
  const runLabel =
    termsToRun.length === 1
      ? termsToRun[0] || "active-term-default"
      : `${termsToRun.length} terms`;
  pushRunLog(run, "info", `Course sync started (${runLabel})`);

  for (let idx = 0; idx < termsToRun.length; idx++) {
    const termCode = termsToRun[idx];
    const label = termCode || "active-term-default";
    pushRunLog(run, "info", `Starting term ${idx + 1}/${termsToRun.length}: ${label}`);
    const result = await executeSingleCourseSyncProcess(termCode, label);
    if (!result.ok) {
      run.status = "failed";
      run.finishedAt = nowIso();
      run.error = result.error || `Term ${label} failed`;
      return;
    }
    pushRunLog(run, "info", `Finished term ${idx + 1}/${termsToRun.length}: ${label}`);
  }

  run.status = "succeeded";
  run.finishedAt = nowIso();
  pushRunLog(run, "info", "Course sync completed successfully");
}

async function executeEmbeddingSyncRun(run: EmbeddingSyncRun) {
  run.status = "running";
  run.startedAt = nowIso();
  pushRunLog(run, "info", "Embeddings sync started");

  const useEmbDistScript = existsSync(embeddingsBackfillDistPath);
  const command = useEmbDistScript ? process.execPath : "pnpm";
  const args = useEmbDistScript ? [embeddingsBackfillDistPath] : ["embeddings:backfill"];

  pushRunLog(
    run,
    "info",
    `Launching ${useEmbDistScript ? `node ${embeddingsBackfillDistPath}` : "pnpm embeddings:backfill"}`
  );

  const child = spawn(command, args, {
    cwd: apiRootDir,
    env: process.env,
    shell: !useEmbDistScript && process.platform === "win32",
  });

  const stdoutBuffer = { value: "" };
  const stderrBuffer = { value: "" };

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");

  child.stdout?.on("data", (chunk: string) => {
    lineSplitPump(run, "info", chunk, stdoutBuffer);
  });
  child.stderr?.on("data", (chunk: string) => {
    lineSplitPump(run, "warn", chunk, stderrBuffer);
  });

  await new Promise<void>((resolve) => {
    child.on("error", (err) => {
      run.status = "failed";
      run.finishedAt = nowIso();
      run.error = err.message || "Failed to launch embeddings sync process";
      pushRunLog(run, "error", run.error);
      resolve();
    });

    child.on("close", (code, signal) => {
      if (stdoutBuffer.value.trim()) {
        pushRunLog(run, "info", stdoutBuffer.value.trim());
      }
      if (stderrBuffer.value.trim()) {
        pushRunLog(run, "warn", stderrBuffer.value.trim());
      }

      if (code === 0) {
        run.status = "succeeded";
        run.finishedAt = nowIso();
        pushRunLog(run, "info", "Embeddings sync completed successfully");
      } else {
        run.status = "failed";
        run.finishedAt = nowIso();
        run.error = `Embeddings sync exited with code=${code ?? "null"} signal=${signal ?? "null"}`;
        pushRunLog(run, "error", run.error);
      }
      resolve();
    });
  });
}

async function executeRmpSyncRun(run: RmpSyncRun) {
  run.status = "running";
  run.startedAt = nowIso();
  const isTargeted = run.onlyInstructorIds.length > 0 || run.onlyTeacherIds.length > 0;
  pushRunLog(run, "info", isTargeted ? "RMP sync started (targeted)" : "RMP sync started");

  const useDistScript = existsSync(rmpSeedDistPath);
  const command = useDistScript ? process.execPath : "pnpm";
  const args = useDistScript ? [rmpSeedDistPath] : ["rmp:seed"];

  const envVars: NodeJS.ProcessEnv = { ...process.env };
  // Force a dedicated checkpoint per run so manual resyncs never skip prior-processed instructors.
  envVars.RMP_CHECKPOINT = `/tmp/rmp-sync-run-${run.id}.json`;
  if (run.onlyInstructorIds.length > 0) {
    envVars.RMP_ONLY_INSTRUCTOR_IDS = run.onlyInstructorIds.join(",");
  } else {
    delete envVars.RMP_ONLY_INSTRUCTOR_IDS;
  }
  if (run.onlyTeacherIds.length > 0) {
    envVars.RMP_ONLY_TEACHER_IDS = run.onlyTeacherIds.join(",");
  } else {
    delete envVars.RMP_ONLY_TEACHER_IDS;
  }

  pushRunLog(
    run,
    "info",
    `Launching ${useDistScript ? `node ${rmpSeedDistPath}` : "pnpm rmp:seed"}`
  );
  if (run.onlyInstructorIds.length > 0) {
    pushRunLog(run, "info", `Filter instructor IDs: ${run.onlyInstructorIds.join(", ")}`);
  }
  if (run.onlyTeacherIds.length > 0) {
    pushRunLog(run, "info", `Filter RMP teacher IDs: ${run.onlyTeacherIds.join(", ")}`);
  }

  const child = spawn(command, args, {
    cwd: apiRootDir,
    env: envVars,
    shell: !useDistScript && process.platform === "win32",
  });

  const stdoutBuffer = { value: "" };
  const stderrBuffer = { value: "" };

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");

  child.stdout?.on("data", (chunk: string) => {
    lineSplitPump(run, "info", chunk, stdoutBuffer);
  });
  child.stderr?.on("data", (chunk: string) => {
    lineSplitPump(run, "warn", chunk, stderrBuffer);
  });

  await new Promise<void>((resolve) => {
    child.on("error", (err) => {
      run.status = "failed";
      run.finishedAt = nowIso();
      run.error = err.message || "Failed to launch RMP sync process";
      pushRunLog(run, "error", run.error);
      resolve();
    });

    child.on("close", (code, signal) => {
      if (stdoutBuffer.value.trim()) {
        pushRunLog(run, "info", stdoutBuffer.value.trim());
      }
      if (stderrBuffer.value.trim()) {
        pushRunLog(run, "warn", stderrBuffer.value.trim());
      }

      if (code === 0) {
        run.status = "succeeded";
        run.finishedAt = nowIso();
        pushRunLog(run, "info", "RMP sync completed successfully");
      } else {
        run.status = "failed";
        run.finishedAt = nowIso();
        run.error = `RMP sync exited with code=${code ?? "null"} signal=${signal ?? "null"}`;
        pushRunLog(run, "error", run.error);
      }
      resolve();
    });
  });
}

async function ensureCourseScheduleTable() {
  await db.execute(sql`
    create table if not exists admin_course_sync_schedule (
      id serial primary key,
      enabled boolean not null default false,
      hour smallint not null default 3,
      minute smallint not null default 0,
      timezone varchar(64) not null default 'America/New_York',
      term_code varchar(10),
      updated_by uuid references users(id),
      updated_at timestamptz not null default now()
    )
  `);
}

async function loadCourseSyncScheduleFromDb() {
  await ensureCourseScheduleTable();
  const rows = (await db.execute(sql`
    select
      enabled,
      hour,
      minute,
      timezone,
      term_code as "termCode",
      updated_by as "updatedBy",
      updated_at as "updatedAt"
    from admin_course_sync_schedule
    order by id desc
    limit 1
  `)) as any[];

  const row = rows[0];
  if (!row) {
    courseScheduleLoaded = true;
    return courseSyncSchedule;
  }

  const timezone = String(row.timezone || DEFAULT_COURSE_SCHEDULE_TIMEZONE);
  courseSyncSchedule = {
    enabled: Boolean(row.enabled),
    hour: Number(row.hour ?? 3),
    minute: Number(row.minute ?? 0),
    timezone: isValidTimezone(timezone) ? timezone : DEFAULT_COURSE_SCHEDULE_TIMEZONE,
    termCode: row.termCode ? String(row.termCode) : null,
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : nowIso(),
  };
  courseScheduleLoaded = true;
  return courseSyncSchedule;
}

async function saveCourseSyncScheduleToDb(input: {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  termCode: string | null;
  updatedBy: string;
}) {
  await ensureCourseScheduleTable();
  const [saved] = (await db.execute(sql`
    insert into admin_course_sync_schedule (enabled, hour, minute, timezone, term_code, updated_by)
    values (${input.enabled}, ${input.hour}, ${input.minute}, ${input.timezone}, ${input.termCode}, ${input.updatedBy}::uuid)
    returning
      enabled,
      hour,
      minute,
      timezone,
      term_code as "termCode",
      updated_by as "updatedBy",
      updated_at as "updatedAt"
  `)) as any[];

  courseSyncSchedule = {
    enabled: Boolean(saved.enabled),
    hour: Number(saved.hour),
    minute: Number(saved.minute),
    timezone: String(saved.timezone),
    termCode: saved.termCode ? String(saved.termCode) : null,
    updatedBy: saved.updatedBy ? String(saved.updatedBy) : null,
    updatedAt: saved.updatedAt ? new Date(saved.updatedAt).toISOString() : nowIso(),
  };
  return courseSyncSchedule;
}

async function maybeTriggerScheduledCourseSyncRun() {
  if (!courseScheduleLoaded) {
    await loadCourseSyncScheduleFromDb();
  }
  if (!courseSyncSchedule.enabled) return;

  const parts = timePartsForZone(new Date(), courseSyncSchedule.timezone);
  if (parts.hour !== courseSyncSchedule.hour || parts.minute !== courseSyncSchedule.minute) {
    return;
  }

  const minuteKey = `${parts.year}-${parts.month}-${parts.day} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  if (courseScheduleLastTriggerKey === minuteKey) return;
  courseScheduleLastTriggerKey = minuteKey;

  const running = getRunningCourseSyncRun();
  if (running) return;

  const run = createCourseSyncRun({
    requestedBy: "scheduler",
    requestedEmail: `scheduler@${courseSyncSchedule.timezone}`,
    termCodes: courseSyncSchedule.termCode ? [courseSyncSchedule.termCode] : [],
    scheduleTriggered: true,
  });
  queueMicrotask(() => {
    void executeCourseSyncRun(run);
  });
}

function startCourseSyncScheduler() {
  if (courseScheduleInitStarted) return;
  courseScheduleInitStarted = true;
  void loadCourseSyncScheduleFromDb();
  setInterval(() => {
    void maybeTriggerScheduledCourseSyncRun();
  }, 30_000);
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
startCourseSyncScheduler();

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

router.get("/course-sync/config", async (_req, res) => {
  const schedule = await loadCourseSyncScheduleFromDb();
  const termsRows = await db
    .select({
      srcdb: terms.srcdb,
      name: terms.name,
      season: terms.season,
      year: terms.year,
      isActive: terms.isActive,
    })
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.srcdb));

  const activeTerm = termsRows.find((term) => term.isActive) || null;

  res.json({
    schedule,
    terms: termsRows,
    activeTermCode: activeTerm?.srcdb || null,
  });
});

router.put("/course-sync/config", async (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  const hour = Number.parseInt(String(req.body?.hour ?? "0"), 10);
  const minute = Number.parseInt(String(req.body?.minute ?? "0"), 10);
  const timezoneRaw = String(
    req.body?.timezone || DEFAULT_COURSE_SCHEDULE_TIMEZONE
  ).trim();
  const termCodeRaw = String(req.body?.termCode || "").trim();
  const termCode = termCodeRaw ? termCodeRaw : null;
  const activeTermCodeRaw = String(req.body?.activeTermCode || "").trim();
  const activeTermCode = activeTermCodeRaw ? activeTermCodeRaw : null;

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return res.status(400).json({ error: "hour must be between 0 and 23" });
  }
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    return res.status(400).json({ error: "minute must be between 0 and 59" });
  }
  if (!isValidTimezone(timezoneRaw)) {
    return res.status(400).json({ error: "Invalid timezone" });
  }

  if (termCode) {
    const ensured = await ensureTermExists(termCode);
    if (!ensured) {
      return res.status(400).json({ error: `Invalid termCode: ${termCode}` });
    }
  }

  if (activeTermCode) {
    const ensured = await ensureTermExists(activeTermCode);
    if (!ensured) {
      return res.status(400).json({ error: `Invalid activeTermCode: ${activeTermCode}` });
    }

    await db.transaction(async (tx) => {
      await tx.update(terms).set({ isActive: false });
      await tx.update(terms).set({ isActive: true }).where(eq(terms.srcdb, activeTermCode));
    });
  }

  const schedule = await saveCourseSyncScheduleToDb({
    enabled,
    hour,
    minute,
    timezone: timezoneRaw,
    termCode,
    updatedBy: req.user!.id,
  });

  const termsRows = await db
    .select({
      srcdb: terms.srcdb,
      name: terms.name,
      season: terms.season,
      year: terms.year,
      isActive: terms.isActive,
    })
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.srcdb));

  const activeTerm = termsRows.find((term) => term.isActive) || null;
  res.json({
    schedule,
    terms: termsRows,
    activeTermCode: activeTerm?.srcdb || null,
  });
});

router.post("/course-sync/runs", async (req, res) => {
  const running = getRunningCourseSyncRun();
  if (running) {
    return res.status(409).json({
      error: "A course sync run is already in progress",
      run: summarizeCourseSyncRun(running),
    });
  }

  const termCodesFromBody: string[] = Array.isArray(req.body?.termCodes)
    ? req.body.termCodes
        .map((raw: unknown) => String(raw ?? "").trim())
        .filter((v: string) => v.length > 0)
    : [];
  const termCodeRaw = String(req.body?.termCode || "").trim();

  const requestedTermCodes: string[] =
    termCodesFromBody.length > 0
      ? termCodesFromBody
      : termCodeRaw
        ? [termCodeRaw]
        : [];
  const termCodes: string[] = Array.from(new Set(requestedTermCodes));

  for (const termCode of termCodes) {
    const ensured = await ensureTermExists(termCode);
    if (!ensured) {
      return res.status(400).json({ error: `Invalid termCode: ${termCode}` });
    }
  }

  const run = createCourseSyncRun({
    requestedBy: req.user!.id,
    requestedEmail: req.user!.email,
    termCodes,
    scheduleTriggered: false,
  });
  queueMicrotask(() => {
    void executeCourseSyncRun(run);
  });

  res.status(202).json(summarizeCourseSyncRun(run));
});

router.get("/course-sync/runs", async (_req, res) => {
  res.json(courseSyncRuns.map(summarizeCourseSyncRun));
});

router.get("/course-sync/runs/:id", async (req, res) => {
  const run = findCourseSyncRunById(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(summarizeCourseSyncRun(run));
});

router.get("/course-sync/runs/:id/logs", async (req, res) => {
  const run = findCourseSyncRunById(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });

  const afterIdRaw = String(req.query.afterId || "0");
  const afterId = Number.parseInt(afterIdRaw, 10);
  const logs = Number.isFinite(afterId)
    ? run.logs.filter((log) => log.id > afterId)
    : run.logs;

  res.json(logs);
});

router.post("/embeddings-sync/runs", async (req, res) => {
  const running = getRunningEmbeddingSyncRun();
  if (running) {
    return res.status(409).json({
      error: "An embeddings sync run is already in progress",
      run: summarizeEmbeddingSyncRun(running),
    });
  }

  const run = createEmbeddingSyncRun({
    requestedBy: req.user!.id,
    requestedEmail: req.user!.email,
  });
  queueMicrotask(() => {
    void executeEmbeddingSyncRun(run);
  });

  res.status(202).json(summarizeEmbeddingSyncRun(run));
});

router.get("/embeddings-sync/runs", async (_req, res) => {
  res.json(embeddingSyncRuns.map(summarizeEmbeddingSyncRun));
});

router.get("/embeddings-sync/runs/:id", async (req, res) => {
  const run = findEmbeddingSyncRunById(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(summarizeEmbeddingSyncRun(run));
});

router.get("/embeddings-sync/runs/:id/logs", async (req, res) => {
  const run = findEmbeddingSyncRunById(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });

  const afterIdRaw = String(req.query.afterId || "0");
  const afterId = Number.parseInt(afterIdRaw, 10);
  const logs = Number.isFinite(afterId)
    ? run.logs.filter((log) => log.id > afterId)
    : run.logs;

  res.json(logs);
});

router.post("/rmp-sync/runs", async (req, res) => {
  const running = getRunningRmpSyncRun();
  if (running) {
    return res.status(409).json({
      error: "An RMP sync run is already in progress",
      run: summarizeRmpSyncRun(running),
    });
  }

  const onlyInstructorIds = normalizeIntList(req.body?.onlyInstructorIds);
  const onlyTeacherIds = normalizeStringList(req.body?.onlyTeacherIds);

  const run = createRmpSyncRun({
    requestedBy: req.user!.id,
    requestedEmail: req.user!.email,
    onlyInstructorIds,
    onlyTeacherIds,
  });
  queueMicrotask(() => {
    void executeRmpSyncRun(run);
  });

  res.status(202).json(summarizeRmpSyncRun(run));
});

router.get("/rmp-sync/runs", async (_req, res) => {
  res.json(rmpSyncRuns.map(summarizeRmpSyncRun));
});

router.get("/rmp-sync/runs/:id", async (req, res) => {
  const run = findRmpSyncRunById(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(summarizeRmpSyncRun(run));
});

router.get("/rmp-sync/runs/:id/logs", async (req, res) => {
  const run = findRmpSyncRunById(req.params.id);
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

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
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
    console.error("Admin user creation failed:", createAuthError?.message);
    const msg = createAuthError?.message || "";
    const safeMsg = msg.includes("already been registered")
      ? "A user with this email already exists"
      : "Failed to create user";
    return res.status(400).json({ error: safeMsg });
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
    console.error("Ban/unban failed:", error.message);
    return res.status(400).json({ error: "Failed to update user access" });
  }

  res.json({ ok: true, userId, banned });
});

router.delete("/users/:id", async (req, res) => {
  const userId = String(req.params.id || "");
  if (!userId) return res.status(400).json({ error: "User id is required" });
  if (userId === req.user!.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const [existingUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existingUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const isAlreadyAuthTombstone = existingUser.email.endsWith("@invalid.local");
  if (!isAlreadyAuthTombstone) {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      const msg = String(authDeleteError.message || "");
      const missingInAuth =
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("user not found");
      // If auth user is already gone, continue profile cleanup.
      if (!missingInAuth) {
        console.error("User deletion failed:", msg);
        return res.status(400).json({ error: "Failed to delete user" });
      }
    }
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
  const recentCourseRuns = courseSyncRuns.slice(0, 20).map((run) => ({
    ...summarizeCourseSyncRun(run),
    latestLogs: run.logs.slice(-20),
  }));
  const recentEmbeddingRuns = embeddingSyncRuns.slice(0, 20).map((run) => ({
    ...summarizeEmbeddingSyncRun(run),
    latestLogs: run.logs.slice(-20),
  }));
  const recentRmpRuns = rmpSyncRuns.slice(0, 20).map((run) => ({
    ...summarizeRmpSyncRun(run),
    latestLogs: run.logs.slice(-20),
  }));

  res.json({
    appErrors: appErrors.slice(0, 200),
    recentRuns,
    recentCourseRuns,
    recentEmbeddingRuns,
    recentRmpRuns,
  });
});

export default router;
