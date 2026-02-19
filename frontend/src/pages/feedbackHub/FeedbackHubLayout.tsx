import { NavLink, Outlet } from "react-router-dom";
import { useFeedbackBoards } from "../../hooks/useFeedbackHub.js";

export default function FeedbackHubLayout() {
  const boardsQuery = useFeedbackBoards();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Feedback Hub</h1>
        <p className="text-sm text-gray-600">
          Vote on ideas, report bugs, and track what we are shipping.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <NavLink
          to="/feedback-hub"
          end
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`
          }
        >
          Roadmap
        </NavLink>
        <NavLink
          to="/feedback-hub/feature-requests"
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`
          }
        >
          Feature Requests
        </NavLink>
        <NavLink
          to="/feedback-hub/bugs"
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`
          }
        >
          Bugs
        </NavLink>
        <NavLink
          to="/feedback-hub/changelog"
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`
          }
        >
          Changelog
        </NavLink>
      </nav>

      {boardsQuery.data && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {boardsQuery.data.map((board) => (
            <span key={board.slug} className="px-2 py-1 rounded bg-gray-100">
              {board.name}: {board.postCount}
            </span>
          ))}
        </div>
      )}

      <Outlet />
    </div>
  );
}
