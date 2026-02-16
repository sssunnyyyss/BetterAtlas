import { useState } from "react";
import { useAuth } from "../lib/auth.js";

export default function Landing() {
  const { login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 sm:p-10 shadow-sm">
          <p className="text-xs font-semibold tracking-wider text-primary-600 uppercase mb-3">
            Development Notice
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            We are still in development.
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            BetterAtlas will be available soon.
          </p>

          {!showLogin && (
            <button
              type="button"
              onClick={() => {
                setShowLogin(true);
                setError("");
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary-600 px-5 py-3 text-sm font-medium text-white hover:bg-primary-700"
            >
              If you already have an account, log in here
            </button>
          )}

          {showLogin && (
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Log in</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-600 text-white py-2.5 rounded-md font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? "Please wait..." : "Sign In"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
