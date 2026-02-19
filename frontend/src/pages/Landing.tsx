import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

export default function Landing() {
  const { login, register, resendVerificationEmail } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [major, setMajor] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const canResendVerification =
    mode === "login" && error.toLowerCase().includes("verify your email");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("emailVerified") === "1") {
      setMode("login");
      setError("");
      setNotice("Email verified. You can sign in now.");
      params.delete("emailVerified");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        // OAuth flow: if ?next= is present, redirect back with the token
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        if (next) {
          const session = await supabase.auth.getSession();
          const accessToken = session.data.session?.access_token;
          if (accessToken) {
            const sep = next.includes("?") ? "&" : "?";
            window.location.href = `${next}${sep}token=${accessToken}`;
            return;
          }
        }
      } else {
        const result = await register({
          email,
          password,
          fullName,
          username,
          graduationYear: graduationYear ? parseInt(graduationYear) : undefined,
          major: major || undefined,
        });
        if (result.requiresEmailVerification) {
          setMode("login");
          setPassword("");
          setNotice(
            "Check your email for a verification link. You need to verify your email before signing in."
          );
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setError("Enter your email to resend the verification email.");
      return;
    }

    setResendingVerification(true);
    setNotice("");
    try {
      await resendVerificationEmail(email.trim());
      setError("");
      setNotice("Verification email sent. Check your inbox (and spam folder).");
    } catch (err: any) {
      setError(err.message || "Failed to resend verification email");
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 text-white flex-col justify-center px-16">
        <h1 className="text-5xl font-bold mb-4">BetterAtlas</h1>
        <p className="text-xl text-primary-100 mb-8">
          Course selection made simple. Search courses, read reviews, and see
          what your friends are taking.
        </p>
        <div className="space-y-4 text-primary-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
              1
            </div>
            <span>Search thousands of courses with powerful filters</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
              2
            </div>
            <span>Read and write honest course reviews</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold">
              3
            </div>
            <span>See what courses your friends are taking</span>
          </div>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-1 lg:hidden">
            BetterAtlas
          </h2>
          <h3 className="text-lg font-medium text-gray-700 mb-6">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </h3>

          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-900">
              Public beta note: AI results can be inaccurate. Please verify details with{" "}
              <a
                href="https://atlas.emory.edu/"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-2 hover:text-amber-950"
              >
                Emory&apos;s Course Atlas
              </a>
              . Known bugs include occasional issues with cross-listed classes.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
              <p>{error}</p>
              {canResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingVerification || loading}
                  className="mt-2 font-medium underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
                >
                  {resendingVerification ? "Sending..." : "Resend verification email"}
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md mb-4 text-sm">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
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
                placeholder={mode === "register" ? "At least 8 characters" : ""}
                className="w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            {mode === "register" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 select-none">@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your_handle"
                      className="flex-1 w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Letters, numbers, and underscores only.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Graduation Year
                    </label>
                    <input
                      type="number"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      placeholder="2026"
                      className="w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Major
                    </label>
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      placeholder="Computer Science"
                      className="w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-md font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setNotice("");
                  }}
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setNotice("");
                  }}
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
