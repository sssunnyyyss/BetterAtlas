import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import OTPInput from "../components/ui/otp-input.js";
import PasswordInput, { getPasswordStrength } from "../components/ui/password-input-1.js";
import { SignInPage } from "../components/ui/sign-in.js";

const LOGIN_HERO_IMAGE =
  "https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80";

type AuthMode = "login" | "register" | "resetRequest" | "resetVerify" | "resetCreatePassword";

function isSafeInternalPath(raw: string): boolean {
  return raw.startsWith("/") && !raw.startsWith("//");
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

const GlassField = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

export default function Landing() {
  const {
    login,
    register,
    resendVerificationEmail,
    requestPasswordResetCode,
    verifyPasswordResetCode,
    completePasswordReset,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [major, setMajor] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
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

  async function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const nextEmail = String(formData.get("email") ?? "").trim();
    const nextPassword = String(formData.get("password") ?? "");
    setEmail(nextEmail);
    setPassword(nextPassword);

    try {
      await login(nextEmail, nextPassword);

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (next) {
        if (isSafeInternalPath(next)) {
          window.location.href = next;
          return;
        }
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        if (accessToken) {
          const sep = next.includes("?") ? "&" : "?";
          window.location.href = `${next}${sep}token=${accessToken}`;
          return;
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const passwordStrength = getPasswordStrength(password);
    if (passwordStrength.score < 4) {
      setError("Password does not meet the required strength yet.");
      setLoading(false);
      return;
    }

    try {
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
          "Check your email for a verification link. You need to verify your email before signing in.",
        );
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setError("Enter your email in the form first, then try again.");
      return;
    }

    setResendingVerification(true);
    setNotice("");
    try {
      await resendVerificationEmail(email.trim());
      setError("");
      setNotice("Verification email sent. Check your inbox (and spam folder).");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setResendingVerification(false);
    }
  }

  async function handleResetRequestSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");

    const nextEmail = resetEmail.trim();
    if (!nextEmail) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordResetCode(nextEmail);
      setResetEmail(nextEmail);
      setResetCode("");
      setResetToken("");
      setResetNewPassword("");
      setConfirmResetPassword("");
      setNotice("A 6-digit verification code was sent if the account exists.");
      setMode("resetVerify");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetVerify(codeFromUi?: string) {
    const code = (codeFromUi ?? resetCode).replace(/\D/g, "").slice(0, 6);
    setResetCode(code);
    setError("");
    setNotice("");

    if (!resetEmail.trim()) {
      setError("Missing reset email. Start the reset flow again.");
      return;
    }
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyPasswordResetCode({
        email: resetEmail.trim(),
        code,
      });
      setResetToken(result.resetToken);
      setMode("resetCreatePassword");
      setNotice("Code verified. Now create your new password.");
      setError("");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCompletePasswordReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!resetToken) {
      setError("Reset session expired. Start again.");
      setMode("resetRequest");
      return;
    }
    if (resetNewPassword !== confirmResetPassword) {
      setError("Passwords do not match.");
      return;
    }
    const strength = getPasswordStrength(resetNewPassword);
    if (strength.score < 4) {
      setError("New password does not meet the required strength.");
      return;
    }

    setLoading(true);
    try {
      await completePasswordReset({
        resetToken,
        newPassword: resetNewPassword,
      });
      setMode("login");
      setPassword("");
      setResetCode("");
      setResetToken("");
      setResetNewPassword("");
      setConfirmResetPassword("");
      setNotice("Password reset successful. Sign in with your new password.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetResend() {
    if (!resetEmail.trim()) {
      setError("Missing reset email. Start the reset flow again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await requestPasswordResetCode(resetEmail.trim());
      setNotice("A new code has been sent if the account exists.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function startResetFlow() {
    setMode("resetRequest");
    setError("");
    setNotice("");
    setResetEmail(email || "");
    setResetCode("");
    setResetToken("");
    setResetNewPassword("");
    setConfirmResetPassword("");
  }

  function switchToRegister() {
    setMode("register");
    setError("");
    setNotice("");
  }

  function switchToLogin() {
    setMode("login");
    setError("");
  }

  const loginDescription: ReactNode = (
    <div className="space-y-3">
      <p>Sign in to explore courses, reviews, schedules, and recommendations.</p>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
      </div>
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}
    </div>
  );

  if (mode === "login") {
    return (
      <div className="bg-background text-foreground">
        <SignInPage
          title={
            <span className="font-bold tracking-tighter text-foreground">
              Welcome to BetterAtlas
            </span>
          }
          description={loginDescription}
          heroImageSrc={LOGIN_HERO_IMAGE}
          onSignIn={handleLoginSubmit}
          onResetPassword={startResetFlow}
          onCreateAccount={switchToRegister}
          isSubmitting={loading}
        />
      </div>
    );
  }

  if (mode === "register") {
    return (
      <div className="flex min-h-[100svh] w-full flex-col overflow-y-auto bg-background font-geist text-foreground md:flex-row">
        <section className="flex flex-1 items-center justify-center p-6 pt-16 pb-10 md:p-8 md:pt-20 md:pb-12">
          <div className="w-full max-w-md">
            <div className="flex flex-col gap-6">
              <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight md:text-5xl">
                Create your account
              </h1>
              <div className="animate-element animate-delay-200 space-y-3 text-muted-foreground">
                <p>Sign up to save schedules, write reviews, and personalize your course search.</p>
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {notice && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    {notice}
                  </div>
                )}
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div className="animate-element animate-delay-300">
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <GlassField>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@university.edu"
                      className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                    />
                  </GlassField>
                </div>

                <div className="animate-element animate-delay-400">
                  <PasswordInput
                    id="register-password"
                    name="password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    required
                    placeholder="At least 8 characters"
                  />
                </div>

                <div className="animate-element animate-delay-500">
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <GlassField>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                    />
                  </GlassField>
                </div>

                <div className="animate-element animate-delay-600">
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <GlassField>
                    <div className="flex items-center rounded-2xl p-1">
                      <span className="px-3 text-muted-foreground">@</span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your_handle"
                        className="w-full rounded-2xl bg-transparent p-3 text-sm focus:outline-none"
                      />
                    </div>
                  </GlassField>
                </div>

                <div className="animate-element animate-delay-700 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Graduation Year</label>
                    <GlassField>
                      <input
                        type="number"
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(e.target.value)}
                        placeholder="2026"
                        className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                      />
                    </GlassField>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Major</label>
                    <GlassField>
                      <input
                        type="text"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                        placeholder="Computer Science"
                        className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                      />
                    </GlassField>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="animate-element animate-delay-800 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Please wait..." : "Create Account"}
                </button>
              </form>

              <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    switchToLogin();
                  }}
                  className="text-violet-500 transition-colors hover:underline"
                >
                  Sign in
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${LOGIN_HERO_IMAGE})` }}
          />
        </section>
      </div>
    );
  }

  if (mode === "resetRequest") {
    return (
      <div className="flex min-h-[100svh] w-full flex-col overflow-y-auto bg-background font-geist text-foreground md:flex-row">
        <section className="flex flex-1 items-center justify-center p-6 py-10 md:p-8 md:py-12">
          <div className="w-full max-w-md space-y-6">
            <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight md:text-5xl">
              Reset your password
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">
              Enter your account email and we&apos;ll send a 6-digit verification code.
            </p>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {notice}
              </div>
            )}

            <form onSubmit={handleResetRequestSubmit} className="space-y-5">
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <GlassField>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@university.edu"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                  />
                </GlassField>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="animate-element animate-delay-400 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Sending code..." : "Send 6-digit code"}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Back to{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  switchToLogin();
                }}
                className="text-violet-500 transition-colors hover:underline"
              >
                Sign in
              </a>
            </p>
          </div>
        </section>

        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${LOGIN_HERO_IMAGE})` }}
          />
        </section>
      </div>
    );
  }

  if (mode === "resetVerify") {
    return (
      <div className="flex min-h-[100svh] w-full flex-col overflow-y-auto bg-background font-geist text-foreground md:flex-row">
        <section className="flex flex-1 items-center justify-center p-6 py-10 md:p-8 md:py-12">
          <div className="w-full max-w-md space-y-5">
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Verify reset code</h1>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium">{resetEmail}</span>.
            </p>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {notice}
              </div>
            )}

            <OTPInput
              value={resetCode}
              onChange={setResetCode}
              onVerify={(code) => {
                void handleResetVerify(code);
              }}
              onResend={() => {
                void handleResetResend();
              }}
              verifyDisabled={loading}
              isVerifying={loading}
              verifyLabel="Verify Code"
              description={`We sent a 6-digit code to ${resetEmail}`}
            />

            <p className="text-center text-sm text-muted-foreground">
              Back to{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  switchToLogin();
                }}
                className="text-violet-500 transition-colors hover:underline"
              >
                Sign in
              </a>
            </p>
          </div>
        </section>

        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${LOGIN_HERO_IMAGE})` }}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100svh] w-full flex-col overflow-y-auto bg-background font-geist text-foreground md:flex-row">
      <section className="flex flex-1 items-center justify-center p-6 py-10 md:p-8 md:py-12">
        <div className="w-full max-w-md space-y-5">
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Create a new password</h1>
          <p className="text-sm text-muted-foreground">
            Your code is verified. Enter your new password twice to confirm.
          </p>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {notice}
            </div>
          )}

          <form onSubmit={handleCompletePasswordReset} className="space-y-5">
            <PasswordInput
              id="reset-new-password"
              name="newPassword"
              label="New Password"
              value={resetNewPassword}
              onChange={setResetNewPassword}
              required
              placeholder="Enter your new password"
            />

            <div>
              <label className="text-sm font-medium text-muted-foreground">Confirm New Password</label>
              <GlassField>
                <input
                  type="password"
                  required
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                />
              </GlassField>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Back to{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                switchToLogin();
              }}
              className="text-violet-500 transition-colors hover:underline"
            >
              Sign in
            </a>
          </p>
        </div>
      </section>

      <section className="relative hidden flex-1 p-4 md:block">
        <div
          className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
          style={{ backgroundImage: `url(${LOGIN_HERO_IMAGE})` }}
        />
      </section>
    </div>
  );
}
