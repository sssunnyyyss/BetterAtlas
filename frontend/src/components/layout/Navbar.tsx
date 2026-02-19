import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth.js";

const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Catalog", path: "/catalog" },
  { label: "My Schedule", path: "/schedule" },
  { label: "Friends", path: "/friends" },
  { label: "Feedback Hub", path: "/feedback-hub" },
  { label: "Profile", path: "/profile" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = user?.isAdmin
    ? [...NAV_ITEMS, { label: "Admin", path: "/admin" }]
    : NAV_ITEMS;

  return (
    <nav className="bg-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--ba-font-display)", color: "#012169" }}>
              BetterAtlas
            </Link>
            <div className="hidden sm:flex gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-500 hidden sm:inline">@{user.username}</span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                Login
              </Link>
            )}
            {/* Hamburger button - mobile only */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-50 min-w-[44px] min-h-[44px] transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          {user && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">@{user.username}</span>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="text-sm text-gray-500 hover:text-gray-900 min-h-[44px] px-3 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
