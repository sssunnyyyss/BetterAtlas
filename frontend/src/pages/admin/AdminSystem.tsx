import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

type SystemMetrics = {
  ts: string;
  host: {
    hostname: string;
    platform: string;
    release: string;
    uptimeSec: number;
    cpuCount: number;
    loadAvg1m: number;
    loadAvg5m: number;
    loadAvg15m: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
    processHeapTotalBytes: number;
  };
  disk: {
    path: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePct: number;
  } | null;
  db: {
    ok: boolean;
    latencyMs: number;
  };
  app: {
    nodeEnv: string;
    version: string;
    pid: number;
    uptimeSec: number;
  };
};

function toGb(bytes: number) {
  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

function toPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function toDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

export default function AdminSystem() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await api.get<SystemMetrics>("/admin/system/metrics");
        if (!cancelled) {
          setMetrics(next);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load system metrics");
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
    return <div className="text-sm text-gray-600">Loading system metrics...</div>;
  }

  if (!metrics) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error || "No system metrics available."}
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

      <div className="text-sm text-gray-500">
        Last updated: {new Date(metrics.ts).toLocaleString()}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">CPU Load (1m)</p>
          <p className="text-2xl font-semibold text-gray-900">
            {metrics.host.loadAvg1m.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.host.cpuCount} logical CPUs
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Host Memory Used</p>
          <p className="text-2xl font-semibold text-gray-900">
            {toPct(
              ((metrics.memory.totalBytes - metrics.memory.freeBytes) /
                metrics.memory.totalBytes) *
                100
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {toGb(metrics.memory.totalBytes - metrics.memory.freeBytes)} /{" "}
            {toGb(metrics.memory.totalBytes)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Disk Usage</p>
          <p className="text-2xl font-semibold text-gray-900">
            {metrics.disk ? toPct(metrics.disk.usagePct) : "N/A"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.disk
              ? `${toGb(metrics.disk.usedBytes)} / ${toGb(metrics.disk.totalBytes)}`
              : "Disk metrics unavailable"}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Database Health</p>
          <p
            className={`text-2xl font-semibold ${
              metrics.db.ok ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {metrics.db.ok ? "Healthy" : "Degraded"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.db.latencyMs}ms ping
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-2">Host</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Hostname</dt>
              <dd className="text-gray-900">{metrics.host.hostname}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Platform</dt>
              <dd className="text-gray-900">
                {metrics.host.platform} {metrics.host.release}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Uptime</dt>
              <dd className="text-gray-900">{toDuration(metrics.host.uptimeSec)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-2">API Process</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Environment</dt>
              <dd className="text-gray-900">{metrics.app.nodeEnv}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Version</dt>
              <dd className="text-gray-900">{metrics.app.version}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">PID</dt>
              <dd className="text-gray-900">{metrics.app.pid}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Process Uptime</dt>
              <dd className="text-gray-900">{toDuration(metrics.app.uptimeSec)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
