import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client.js";

type RunStatus = "queued" | "running" | "succeeded" | "failed";

type SyncRunSummary = {
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

type SyncRunLog = {
  id: number;
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
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

export default function AdminSync() {
  const [runs, setRuns] = useState<SyncRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRun, setSelectedRun] = useState<SyncRunSummary | null>(null);
  const [logs, setLogs] = useState<SyncRunLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [message, setMessage] = useState("");

  const selectedRunIsActive =
    selectedRun?.status === "queued" || selectedRun?.status === "running";

  const loadRuns = useCallback(async () => {
    const data = await api.get<SyncRunSummary[]>("/admin/sync/runs");
    setRuns(data);
    if (data.length === 0) {
      setSelectedRunId(null);
      setSelectedRun(null);
      setLogs([]);
      return;
    }
    setSelectedRunId((prev) => {
      if (prev && data.some((run) => run.id === prev)) return prev;
      return data[0]!.id;
    });
  }, []);

  const loadRunDetails = useCallback(
    async (
      runId: number,
      opts?: { resetLogs?: boolean; afterId?: number }
    ) => {
      const run = await api.get<SyncRunSummary>(`/admin/sync/runs/${runId}`);
      setSelectedRun(run);
      const afterId = opts?.resetLogs ? 0 : (opts?.afterId ?? 0);
      const newLogs = await api.get<SyncRunLog[]>(
        `/admin/sync/runs/${runId}/logs?afterId=${afterId}`
      );
      if (opts?.resetLogs) {
        setLogs(newLogs);
      } else if (newLogs.length > 0) {
        setLogs((prev) => [...prev, ...newLogs]);
      }
    },
    []
  );

  async function handleStartRun() {
    setIsStarting(true);
    setMessage("");
    try {
      const run = await api.post<SyncRunSummary>("/admin/sync/runs");
      setSelectedRunId(run.id);
      setSelectedRun(run);
      setLogs([]);
      setMessage("Programs sync run started.");
      await loadRuns();
    } catch (err: any) {
      setMessage(err.message || "Failed to start sync run");
    } finally {
      setIsStarting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadRuns();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    const interval = setInterval(() => {
      void loadRuns();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId) return;
    void loadRunDetails(selectedRunId, { resetLogs: true });
  }, [selectedRunId, loadRunDetails]);

  useEffect(() => {
    if (!selectedRunId || !selectedRunIsActive) return;
    const interval = setInterval(() => {
      const afterId = logs.length > 0 ? logs[logs.length - 1]!.id : 0;
      void loadRunDetails(selectedRunId, { afterId });
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedRunId, selectedRunIsActive, logs, loadRunDetails]);

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading sync dashboard...</div>;
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Programs Sync</h2>
          <button
            onClick={handleStartRun}
            disabled={isStarting}
            className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50"
          >
            {isStarting ? "Starting..." : "Run Sync"}
          </button>
        </div>
        {message && <p className="text-sm text-gray-600">{message}</p>}

        <div className="space-y-2 max-h-[420px] overflow-auto">
          {runs.length === 0 && (
            <p className="text-sm text-gray-500">No runs yet.</p>
          )}
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={`w-full text-left rounded-md border p-3 transition-colors ${
                selectedRunId === run.id
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
        {!selectedRun && (
          <p className="text-sm text-gray-500">Select a run to inspect details.</p>
        )}

        {selectedRun && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Run #{selectedRun.id}</h3>
              <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[selectedRun.status]}`}>
                {selectedRun.status}
              </span>
              <span className="text-xs text-gray-500">
                Requested by {selectedRun.requestedEmail}
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Started</p>
                <p className="text-gray-900">{formatTs(selectedRun.startedAt)}</p>
              </div>
              <div>
                <p className="text-gray-500">Finished</p>
                <p className="text-gray-900">{formatTs(selectedRun.finishedAt)}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Error</p>
                <p className="text-gray-900 break-words">
                  {selectedRun.error || "None"}
                </p>
              </div>
            </div>

            {selectedRun.stats && (
              <div className="grid md:grid-cols-4 gap-3 text-sm">
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-gray-500">Fetched</p>
                  <p className="font-semibold text-gray-900">
                    {selectedRun.stats.fetchedPrograms}
                  </p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-gray-500">Upserted</p>
                  <p className="font-semibold text-gray-900">
                    {selectedRun.stats.upsertedPrograms}
                  </p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-gray-500">Updated</p>
                  <p className="font-semibold text-gray-900">
                    {selectedRun.stats.updatedRequirements}
                  </p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-gray-500">Errors</p>
                  <p className="font-semibold text-gray-900">
                    {selectedRun.stats.errors.length}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Run Logs</h4>
              <div className="bg-gray-950 text-gray-100 rounded-md p-3 h-[340px] overflow-auto font-mono text-xs space-y-1">
                {logs.length === 0 && <p className="text-gray-400">No logs yet.</p>}
                {logs.map((log) => (
                  <p key={log.id}>
                    <span className="text-gray-400">
                      {new Date(log.ts).toLocaleTimeString()}
                    </span>{" "}
                    <span
                      className={
                        log.level === "error"
                          ? "text-red-300"
                          : log.level === "warn"
                            ? "text-yellow-300"
                            : "text-emerald-300"
                      }
                    >
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
  );
}
