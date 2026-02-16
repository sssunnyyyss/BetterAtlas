import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

type AppError = {
  id: number;
  ts: string;
  method: string;
  path: string;
  status: number;
  message: string;
  stack: string | null;
  userId: string | null;
};

type RunLog = {
  id: number;
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
};

type RecentRun = {
  id: number;
  type: "programs_sync" | "courses_sync";
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestedBy: string;
  requestedEmail: string;
  stats: unknown;
  error: string | null;
  logCount: number;
  latestLogs: RunLog[];
};

type AdminLogsResponse = {
  appErrors: AppError[];
  recentRuns: RecentRun[];
  recentCourseRuns?: RecentRun[];
};

export default function AdminLogs() {
  const [data, setData] = useState<AdminLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await api.get<AdminLogsResponse>("/admin/logs");
        if (!cancelled) {
          setData(next);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load logs");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    const interval = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading logs...</div>;
  }

  if (!data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error || "No logs available."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Application Errors</h2>
        <div className="space-y-2 max-h-[320px] overflow-auto">
          {data.appErrors.length === 0 && (
            <p className="text-sm text-gray-500">No application errors recorded.</p>
          )}
          {data.appErrors.map((item) => (
            <div
              key={item.id}
              className="rounded border border-red-100 bg-red-50 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
                  {item.status}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(item.ts).toLocaleString()}
                </span>
                <span className="text-xs text-gray-600">
                  {item.method} {item.path}
                </span>
              </div>
              <p className="text-red-800">{item.message}</p>
              {item.userId && (
                <p className="text-xs text-red-700 mt-1">User: {item.userId}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Recent Sync Diagnostics</h2>
        <div className="space-y-3">
          {data.recentRuns.length === 0 &&
            (data.recentCourseRuns?.length ?? 0) === 0 && (
            <p className="text-sm text-gray-500">No sync runs recorded yet.</p>
          )}
          {[...data.recentRuns, ...(data.recentCourseRuns ?? [])].map((run) => (
            <div key={run.id} className="rounded border border-gray-200 p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-900">Run #{run.id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {run.status}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-primary-50 text-primary-700">
                  {run.type}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
              </div>
              {run.error && <p className="text-sm text-red-700 mb-2">{run.error}</p>}
              <div className="bg-gray-950 text-gray-100 rounded p-2 max-h-40 overflow-auto font-mono text-xs space-y-1">
                {run.latestLogs.length === 0 && (
                  <p className="text-gray-400">No logs captured.</p>
                )}
                {run.latestLogs.map((log) => (
                  <p key={log.id}>
                    <span className="text-gray-400">
                      {new Date(log.ts).toLocaleTimeString()}
                    </span>{" "}
                    <span>{log.message}</span>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
