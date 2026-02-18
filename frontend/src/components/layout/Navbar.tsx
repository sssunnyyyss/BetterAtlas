import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth.js";

const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Catalog", path: "/catalog" },
  { label: "My Schedule", path: "/schedule" },
  { label: "Friends", path: "/friends" },
  { label: "Feedback", path: "/feedback" },
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
    <nav className="bg-primary-600 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: "var(--ba-font-display)" }}>
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
                        ? "bg-white/20 text-white"
                        : "text-primary-100 hover:bg-white/10 hover:text-white"
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
                <span className="text-sm text-primary-200 hidden sm:inline">@{user.username}</span>
                <button
                  onClick={logout}
                  className="text-sm text-primary-200 hover:text-white hidden sm:inline transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-white border border-white/40 rounded-md px-3 py-1.5 hover:bg-white/10 transition-colors"
              >
                Login
              </Link>
            )}
            {/* Hamburger button - mobile only */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-primary-200 hover:text-white hover:bg-white/10 min-w-[44px] min-h-[44px] transition-colors"
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
        <div className="sm:hidden border-t border-white/20 bg-primary-700">
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
                      ? "bg-white/20 text-white"
                      : "text-primary-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          {user && (
            <div className="border-t border-white/20 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-primary-200">@{user.username}</span>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="text-sm text-primary-200 hover:text-white min-h-[44px] px-3 transition-colors"
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
