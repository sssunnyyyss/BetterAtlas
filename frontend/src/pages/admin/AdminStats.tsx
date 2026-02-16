import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

type StatsOverview = {
  windowDays: number;
  users: {
    total: number;
    newInWindow: number;
  };
  reviews: {
    total: number;
    newInWindow: number;
  };
  catalog: {
    courses: number;
    activeSections: number;
    activePrograms: number;
    lastSuccessfulProgramsSyncAt: string | null;
  };
  social: {
    pendingFriendships: number;
    acceptedFriendships: number;
  };
};

function formatTs(ts: string | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString();
}

export default function AdminStats() {
  const [windowDays, setWindowDays] = useState(7);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<StatsOverview>(
          `/admin/stats/overview?windowDays=${windowDays}`
        );
        if (!cancelled) {
          setStats(data);
          setError("");
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load stats");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading stats...</div>;
  }

  if (!stats) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error || "No stats available."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Window</label>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
          className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.users.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            +{stats.users.newInWindow} in last {stats.windowDays} days
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Reviews</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.reviews.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            +{stats.reviews.newInWindow} in last {stats.windowDays} days
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active Sections</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.catalog.activeSections}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.catalog.courses} total courses
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active Programs</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.catalog.activePrograms}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Last sync: {formatTs(stats.catalog.lastSuccessfulProgramsSyncAt)}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-2">Social</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Pending requests</dt>
              <dd className="text-gray-900">{stats.social.pendingFriendships}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Accepted friendships</dt>
              <dd className="text-gray-900">{stats.social.acceptedFriendships}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-2">Catalog Snapshot</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Courses</dt>
              <dd className="text-gray-900">{stats.catalog.courses}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Sections</dt>
              <dd className="text-gray-900">{stats.catalog.activeSections}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Programs</dt>
              <dd className="text-gray-900">{stats.catalog.activePrograms}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
