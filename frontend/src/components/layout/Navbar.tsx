import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth.js";

const NAV_ITEMS = [
  { label: "Catalog", path: "/catalog" },
  { label: "Friends", path: "/friends" },
  { label: "Profile", path: "/profile" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/catalog" className="text-xl font-bold text-primary-600">
              BetterAtlas
            </Link>
            <div className="hidden sm:flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname.startsWith(item.path)
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-gray-600">{user.displayName}</span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
