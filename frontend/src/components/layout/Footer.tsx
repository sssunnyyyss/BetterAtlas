import { Link, useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();

  // Hide footer on the landing/login page
  if (location.pathname === "/login") return null;

  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo / Brand */}
          <Link
            to="/"
            className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
            style={{ fontFamily: "var(--ba-font-display)", color: "#012169" }}
          >
            BetterAtlas
          </Link>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <Link to="/feedback-hub" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Feedback
            </Link>
            <Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/faq" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              FAQ
            </Link>
            <Link to="/about" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              About Us
            </Link>
          </nav>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} BetterAtlas. Course selection made simple.
        </p>
      </div>
    </footer>
  );
}
