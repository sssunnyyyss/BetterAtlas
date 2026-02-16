import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";

type RunStatus = "queued" | "running" | "succeeded" | "failed";

type ProgramSyncRunSummary = {
  id: number;
  type: "programs_sync";
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string;
  requestedEmail: string;
  error: string | null;
  stats: {
    fetchedPrograms: number;
    upsertedPrograms: number;
    updatedRequirements: number;
    skippedUnchanged: number;
    errors: Array<{ sourceUrl: string; error: string }>;
  } | null;
  logCount: number;
};

type CourseSyncRunSummary = {
  id: number;
  type: "courses_sync";
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string;
  requestedEmail: string;
  termCode: string | null;
  scheduleTriggered: boolean;
  error: string | null;
  logCount: number;
};

type SyncRunLog = {
  id: number;
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
};

type TermOption = {
  srcdb: string;
  name: string;
  season: string;
  year: number;
  isActive: boolean | null;
};

type CourseSyncConfigResponse = {
  schedule: {
    enabled: boolean;
    hour: number;
    minute: number;
    timezone: string;
    termCode: string | null;
    updatedBy: string | null;
    updatedAt: string;
  };
  terms: TermOption[];
  activeTermCode: string | null;
};

const STATUS_STYLE: Record<RunStatus, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  succeeded: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function formatTs(ts: string | null) {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleString();
}

function hourMinuteToInputValue(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function inputValueToHourMinute(value: string) {
  const [hourStr, minuteStr] = value.split(":");
  const hour = Number.parseInt(hourStr ?? "0", 10);
  const minute = Number.parseInt(minuteStr ?? "0", 10);
  return {
    hour: Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 23) : 0,
    minute: Number.isFinite(minute) ? Math.min(Math.max(minute, 0), 59) : 0,
  };
}

function runLogClass(level: SyncRunLog["level"]) {
  if (level === "error") return "text-red-300";
  if (level === "warn") return "text-yellow-300";
  return "text-emerald-300";
}

export default function AdminSync() {
  const [isLoading, setIsLoading] = useState(true);

  const [courseConfig, setCourseConfig] = useState<CourseSyncConfigResponse | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("03:00");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/New_York");
  const [scheduleTermCode, setScheduleTermCode] = useState("");
  const [activeTermCode, setActiveTermCode] = useState("");
  const [manualRunTermCode, setManualRunTermCode] = useState("");

  const [courseRuns, setCourseRuns] = useState<CourseSyncRunSummary[]>([]);
  const [selectedCourseRunId, setSelectedCourseRunId] = useState<number | null>(null);
  const [selectedCourseRun, setSelectedCourseRun] = useState<CourseSyncRunSummary | null>(null);
  const [courseLogs, setCourseLogs] = useState<SyncRunLog[]>([]);

  const [programRuns, setProgramRuns] = useState<ProgramSyncRunSummary[]>([]);
  const [selectedProgramRunId, setSelectedProgramRunId] = useState<number | null>(null);
  const [selectedProgramRun, setSelectedProgramRun] = useState<ProgramSyncRunSummary | null>(null);
  const [programLogs, setProgramLogs] = useState<SyncRunLog[]>([]);

  const [isSavingCourseConfig, setIsSavingCourseConfig] = useState(false);
  const [isStartingCourseRun, setIsStartingCourseRun] = useState(false);
  const [isStartingProgramRun, setIsStartingProgramRun] = useState(false);
  const [message, setMessage] = useState("");

  const selectedCourseRunIsActive =
    selectedCourseRun?.status === "queued" || selectedCourseRun?.status === "running";
  const selectedProgramRunIsActive =
    selectedProgramRun?.status === "queued" || selectedProgramRun?.status === "running";

  const courseLastLogId = useMemo(
    () => (courseLogs.length > 0 ? courseLogs[courseLogs.length - 1]!.id : 0),
    [courseLogs]
  );
  const programLastLogId = useMemo(
    () => (programLogs.length > 0 ? programLogs[programLogs.length - 1]!.id : 0),
    [programLogs]
  );

  const loadCourseConfig = useCallback(async () => {
    const data = await api.get<CourseSyncConfigResponse>("/admin/course-sync/config");
    setCourseConfig(data);
    setScheduleEnabled(Boolean(data.schedule.enabled));
    setScheduleTime(hourMinuteToInputValue(data.schedule.hour, data.schedule.minute));
    setScheduleTimezone(data.schedule.timezone || "America/New_York");
    setScheduleTermCode(data.schedule.termCode || "");
    setActiveTermCode(data.activeTermCode || "");
    setManualRunTermCode(data.schedule.termCode || data.activeTermCode || "");
  }, []);

  const loadCourseRuns = useCallback(async () => {
    const data = await api.get<CourseSyncRunSummary[]>("/admin/course-sync/runs");
    setCourseRuns(data);
    setSelectedCourseRunId((prev) => {
      if (data.length === 0) return null;
      if (prev && data.some((run) => run.id === prev)) return prev;
      return data[0]!.id;
    });
  }, []);

  const loadProgramRuns = useCallback(async () => {
    const data = await api.get<ProgramSyncRunSummary[]>("/admin/sync/runs");
    setProgramRuns(data);
    setSelectedProgramRunId((prev) => {
      if (data.length === 0) return null;
      if (prev && data.some((run) => run.id === prev)) return prev;
      return data[0]!.id;
    });
  }, []);

  const loadCourseRunDetails = useCallback(
    async (runId: number, opts?: { resetLogs?: boolean; afterId?: number }) => {
      const run = await api.get<CourseSyncRunSummary>(`/admin/course-sync/runs/${runId}`);
      setSelectedCourseRun(run);
      const afterId = opts?.resetLogs ? 0 : (opts?.afterId ?? 0);
      const newLogs = await api.get<SyncRunLog[]>(
        `/admin/course-sync/runs/${runId}/logs?afterId=${afterId}`
      );
      if (opts?.resetLogs) {
        setCourseLogs(newLogs);
      } else if (newLogs.length > 0) {
        setCourseLogs((prev) => [...prev, ...newLogs]);
      }
    },
    []
  );

  const loadProgramRunDetails = useCallback(
    async (runId: number, opts?: { resetLogs?: boolean; afterId?: number }) => {
      const run = await api.get<ProgramSyncRunSummary>(`/admin/sync/runs/${runId}`);
      setSelectedProgramRun(run);
      const afterId = opts?.resetLogs ? 0 : (opts?.afterId ?? 0);
      const newLogs = await api.get<SyncRunLog[]>(
        `/admin/sync/runs/${runId}/logs?afterId=${afterId}`
      );
      if (opts?.resetLogs) {
        setProgramLogs(newLogs);
      } else if (newLogs.length > 0) {
        setProgramLogs((prev) => [...prev, ...newLogs]);
      }
    },
    []
  );

  async function handleSaveCourseConfig() {
    if (!courseConfig) return;
    setIsSavingCourseConfig(true);
    setMessage("");
    try {
      const { hour, minute } = inputValueToHourMinute(scheduleTime);
      const updated = await api.put<CourseSyncConfigResponse>("/admin/course-sync/config", {
        enabled: scheduleEnabled,
        hour,
        minute,
        timezone: scheduleTimezone,
        termCode: scheduleTermCode || null,
        activeTermCode: activeTermCode || null,
      });
      setCourseConfig(updated);
      setMessage("Course sync schedule saved.");
    } catch (err: any) {
      setMessage(err.message || "Failed to save course sync schedule");
    } finally {
      setIsSavingCourseConfig(false);
    }
  }

  async function handleStartCourseRun() {
    setIsStartingCourseRun(true);
    setMessage("");
    try {
      const run = await api.post<CourseSyncRunSummary>("/admin/course-sync/runs", {
        termCode: manualRunTermCode || null,
      });
      setSelectedCourseRunId(run.id);
      setSelectedCourseRun(run);
      setCourseLogs([]);
      setMessage("Course sync run started.");
      await loadCourseRuns();
    } catch (err: any) {
      setMessage(err.message || "Failed to start course sync");
    } finally {
      setIsStartingCourseRun(false);
    }
  }

  async function handleStartProgramRun() {
    setIsStartingProgramRun(true);
    setMessage("");
    try {
      const run = await api.post<ProgramSyncRunSummary>("/admin/sync/runs");
      setSelectedProgramRunId(run.id);
      setSelectedProgramRun(run);
      setProgramLogs([]);
      setMessage("Programs sync run started.");
      await loadProgramRuns();
    } catch (err: any) {
      setMessage(err.message || "Failed to start programs sync");
    } finally {
      setIsStartingProgramRun(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadCourseConfig(), loadCourseRuns(), loadProgramRuns()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCourseConfig, loadCourseRuns, loadProgramRuns]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadCourseRuns();
      void loadProgramRuns();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadCourseRuns, loadProgramRuns]);

  useEffect(() => {
    if (!selectedCourseRunId) return;
    void loadCourseRunDetails(selectedCourseRunId, { resetLogs: true });
  }, [selectedCourseRunId, loadCourseRunDetails]);

  useEffect(() => {
    if (!selectedProgramRunId) return;
    void loadProgramRunDetails(selectedProgramRunId, { resetLogs: true });
  }, [selectedProgramRunId, loadProgramRunDetails]);

  useEffect(() => {
    if (!selectedCourseRunId || !selectedCourseRunIsActive) return;
    const interval = setInterval(() => {
      void loadCourseRunDetails(selectedCourseRunId, { afterId: courseLastLogId });
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedCourseRunId, selectedCourseRunIsActive, courseLastLogId, loadCourseRunDetails]);

  useEffect(() => {
    if (!selectedProgramRunId || !selectedProgramRunIsActive) return;
    const interval = setInterval(() => {
      void loadProgramRunDetails(selectedProgramRunId, { afterId: programLastLogId });
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedProgramRunId, selectedProgramRunIsActive, programLastLogId, loadProgramRunDetails]);

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading sync dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Course Sync (Atlas FOSE)</h2>
            <p className="text-sm text-gray-600">
              Schedule daily syncs and choose which semester (`srcdb`) to scrape.
            </p>
          </div>
          <button
            onClick={handleStartCourseRun}
            disabled={isStartingCourseRun}
            className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50"
          >
            {isStartingCourseRun ? "Starting..." : "Run Course Sync Now"}
          </button>
        </div>

        {message && <p className="text-sm text-gray-600">{message}</p>}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Active Semester (default)</span>
            <input
              list="term-codes"
              placeholder="e.g. 5269"
              value={activeTermCode}
              onChange={(e) => setActiveTermCode(e.target.value)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-500">Scheduled Time (daily)</span>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-500">Timezone</span>
            <select
              value={scheduleTimezone}
              onChange={(e) => setScheduleTimezone(e.target.value)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="America/New_York">America/New_York</option>
              <option value="UTC">UTC</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-500">Scheduled Term Override</span>
            <input
              list="term-codes"
              placeholder="blank = use active semester"
              value={scheduleTermCode}
              onChange={(e) => setScheduleTermCode(e.target.value)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Enable scheduled daily sync
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            Manual Run Term:
            <input
              list="term-codes"
              placeholder="blank = use active semester"
              value={manualRunTermCode}
              onChange={(e) => setManualRunTermCode(e.target.value)}
              className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </label>

          <button
            onClick={handleSaveCourseConfig}
            disabled={isSavingCourseConfig}
            className="bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {isSavingCourseConfig ? "Saving..." : "Save Schedule"}
          </button>
        </div>

        {courseConfig?.schedule.updatedAt && (
          <p className="text-xs text-gray-500">
            Last updated: {new Date(courseConfig.schedule.updatedAt).toLocaleString()}
          </p>
        )}

        <datalist id="term-codes">
          {(courseConfig?.terms ?? []).map((term) => (
            <option key={term.srcdb} value={term.srcdb}>
              {term.name}
            </option>
          ))}
        </datalist>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Recent Course Sync Runs</h3>
          <div className="space-y-2 max-h-[360px] overflow-auto">
            {courseRuns.length === 0 && (
              <p className="text-sm text-gray-500">No course sync runs yet.</p>
            )}
            {courseRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedCourseRunId(run.id)}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  selectedCourseRunId === run.id
                    ? "border-primary-300 bg-primary-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">Run #{run.id}</span>
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[run.status]}`}>
                    {run.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{formatTs(run.createdAt)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Term: {run.termCode || "active default"} | Logs: {run.logCount}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          {!selectedCourseRun ? (
            <p className="text-sm text-gray-500">Select a course sync run to inspect logs.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900">Course Run #{selectedCourseRun.id}</h3>
                <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[selectedCourseRun.status]}`}>
                  {selectedCourseRun.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Requested by {selectedCourseRun.requestedEmail} | Term{" "}
                {selectedCourseRun.termCode || "active default"}
              </p>
              <p className="text-xs text-gray-500">
                Started: {formatTs(selectedCourseRun.startedAt)} | Finished:{" "}
                {formatTs(selectedCourseRun.finishedAt)}
              </p>
              {selectedCourseRun.error && (
                <p className="text-sm text-red-700">{selectedCourseRun.error}</p>
              )}

              <div className="bg-gray-950 text-gray-100 rounded-md p-3 h-[280px] overflow-auto font-mono text-xs space-y-1">
                {courseLogs.length === 0 && (
                  <p className="text-gray-400">No logs yet.</p>
                )}
                {courseLogs.map((log) => (
                  <p key={log.id}>
                    <span className="text-gray-400">
                      {new Date(log.ts).toLocaleTimeString()}
                    </span>{" "}
                    <span className={runLogClass(log.level)}>
                      [{log.level.toUpperCase()}]
                    </span>{" "}
                    <span>{log.message}</span>
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Programs Sync</h2>
            <button
              onClick={handleStartProgramRun}
              disabled={isStartingProgramRun}
              className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50"
            >
              {isStartingProgramRun ? "Starting..." : "Run Programs Sync"}
            </button>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-auto">
            {programRuns.length === 0 && (
              <p className="text-sm text-gray-500">No runs yet.</p>
            )}
            {programRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedProgramRunId(run.id)}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  selectedProgramRunId === run.id
                    ? "border-primary-300 bg-primary-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">Run #{run.id}</span>
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[run.status]}`}>
                    {run.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{formatTs(run.createdAt)}</p>
                <p className="text-xs text-gray-500 mt-1">{run.logCount} logs</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {!selectedProgramRun && (
            <p className="text-sm text-gray-500">Select a programs run to inspect details.</p>
          )}

          {selectedProgramRun && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Programs Run #{selectedProgramRun.id}
                </h3>
                <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[selectedProgramRun.status]}`}>
                  {selectedProgramRun.status}
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Started</p>
                  <p className="text-gray-900">{formatTs(selectedProgramRun.startedAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Finished</p>
                  <p className="text-gray-900">{formatTs(selectedProgramRun.finishedAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Last Error</p>
                  <p className="text-gray-900 break-words">
                    {selectedProgramRun.error || "None"}
                  </p>
                </div>
              </div>

              {selectedProgramRun.stats && (
                <div className="grid md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-gray-500">Fetched</p>
                    <p className="font-semibold text-gray-900">
                      {selectedProgramRun.stats.fetchedPrograms}
                    </p>
                  </div>
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-gray-500">Upserted</p>
                    <p className="font-semibold text-gray-900">
                      {selectedProgramRun.stats.upsertedPrograms}
                    </p>
                  </div>
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-gray-500">Updated</p>
                    <p className="font-semibold text-gray-900">
                      {selectedProgramRun.stats.updatedRequirements}
                    </p>
                  </div>
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-gray-500">Errors</p>
                    <p className="font-semibold text-gray-900">
                      {selectedProgramRun.stats.errors.length}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Run Logs</h4>
                <div className="bg-gray-950 text-gray-100 rounded-md p-3 h-[280px] overflow-auto font-mono text-xs space-y-1">
                  {programLogs.length === 0 && (
                    <p className="text-gray-400">No logs yet.</p>
                  )}
                  {programLogs.map((log) => (
                    <p key={log.id}>
                      <span className="text-gray-400">
                        {new Date(log.ts).toLocaleTimeString()}
                      </span>{" "}
                      <span className={runLogClass(log.level)}>
                        [{log.level.toUpperCase()}]
                      </span>{" "}
                      <span>{log.message}</span>
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
