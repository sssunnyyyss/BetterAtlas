import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth.js";
import Navbar from "./components/layout/Navbar.js";
import Footer from "./components/layout/Footer.js";
import OnboardingProvider from "./components/onboarding/OnboardingProvider.js";
import MobileDesktopNotice from "./components/layout/MobileDesktopNotice.js";

const Landing = lazy(() => import("./pages/Landing.js"));
const Home = lazy(() => import("./pages/Home.js"));
const Catalog = lazy(() => import("./pages/Catalog.js"));
const CourseDetail = lazy(() => import("./pages/CourseDetail.js"));
const ProfessorDetail = lazy(() => import("./pages/ProfessorDetail.js"));
const Profile = lazy(() => import("./pages/Profile.js"));
const Friends = lazy(() => import("./pages/Friends.js"));
const Schedule = lazy(() => import("./pages/Schedule.js"));
const Wishlist = lazy(() => import("./pages/Wishlist.js"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.js"));
const FAQ = lazy(() => import("./pages/FAQ.js"));
const AboutUs = lazy(() => import("./pages/AboutUs.js"));
const AiChat = lazy(() => import("./pages/AiChat.js"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.js"));
const AdminSync = lazy(() => import("./pages/admin/AdminSync.js"));
const AdminAiTrainer = lazy(() => import("./pages/admin/AdminAiTrainer.js"));
const AdminSystem = lazy(() => import("./pages/admin/AdminSystem.js"));
const AdminStats = lazy(() => import("./pages/admin/AdminStats.js"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.js"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs.js"));
const AdminInviteCodes = lazy(() => import("./pages/admin/AdminInviteCodes.js"));
const AdminFeedback = lazy(() => import("./pages/admin/AdminFeedback.js"));
const FeedbackHubLayout = lazy(() => import("./pages/feedbackHub/FeedbackHubLayout.js"));
const FeedbackHubRoadmap = lazy(() => import("./pages/feedbackHub/FeedbackHubRoadmap.js"));
const FeedbackHubBoard = lazy(() => import("./pages/feedbackHub/FeedbackHubBoard.js"));
const FeedbackHubPostDetail = lazy(() => import("./pages/feedbackHub/FeedbackHubPostDetail.js"));
const FeedbackHubChangelog = lazy(() => import("./pages/feedbackHub/FeedbackHubChangelog.js"));

function getSafeInternalNext(rawNext: string | null): string | null {
  if (!rawNext) return null;
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return null;
  return rawNext;
}

function RouteLoadingScreen() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!user.isAdmin) return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

function LoginRoute({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const location = useLocation();
  if (!user) return <Landing />;

  const params = new URLSearchParams(location.search);
  const safeNext = getSafeInternalNext(params.get("next"));
  return <Navigate to={safeNext ?? "/"} replace />;
}

function AppRoutes({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="ba-page-fade">
      <Suspense fallback={<RouteLoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginRoute user={user} />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/:id" element={<CourseDetail />} />
          <Route path="/ai" element={<AiChat />} />
          <Route path="/professors/:id" element={<ProfessorDetail />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <Friends />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <Schedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wishlist"
            element={
              <ProtectedRoute>
                <Wishlist />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="/admin/sync" replace />} />
            <Route path="sync" element={<AdminSync />} />
            <Route path="developers" element={<AdminAiTrainer />} />
            <Route path="ai-trainer" element={<Navigate to="/admin/developers" replace />} />
            <Route path="system" element={<AdminSystem />} />
            <Route path="stats" element={<AdminStats />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="invite-codes" element={<AdminInviteCodes />} />
            <Route path="feedback" element={<AdminFeedback />} />
            <Route path="logs" element={<AdminLogs />} />
          </Route>
          <Route path="/feedback-hub" element={<FeedbackHubLayout />}>
            <Route index element={<FeedbackHubRoadmap />} />
            <Route path="changelog" element={<FeedbackHubChangelog />} />
            <Route path=":boardSlug" element={<FeedbackHubBoard />} />
            <Route path=":boardSlug/post/:postId" element={<FeedbackHubPostDetail />} />
          </Route>
          <Route path="/feedback" element={<Navigate to="/feedback-hub" replace />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppShell user={user} />
    </BrowserRouter>
  );
}

function AppShell({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const location = useLocation();
  const isLoginRoute =
    location.pathname === "/login" || location.pathname.startsWith("/login/");

  return (
    <OnboardingProvider>
      <div className="flex min-h-screen flex-col">
        {!isLoginRoute && <Navbar />}
        {!isLoginRoute && <MobileDesktopNotice />}
        <AppRoutes user={user} />
        {!isLoginRoute && <Footer />}
      </div>
    </OnboardingProvider>
  );
}
