import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { label: "Sync", path: "/admin/sync" },
  { label: "System", path: "/admin/system" },
  { label: "Stats", path: "/admin/stats" },
  { label: "Users", path: "/admin/users" },
  { label: "Logs", path: "/admin/logs" },
];

export default function AdminLayout() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-600 mt-1">
          Operations dashboard for sync, diagnostics, and account management.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
