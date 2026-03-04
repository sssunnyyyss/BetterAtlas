import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth.js";
import Navbar from "./components/layout/Navbar.js";
import Landing from "./pages/Landing.js";
import Home from "./pages/Home.js";
import Catalog from "./pages/Catalog.js";
import CourseDetail from "./pages/CourseDetail.js";
import ProfessorDetail from "./pages/ProfessorDetail.js";
import Profile from "./pages/Profile.js";
import Friends from "./pages/Friends.js";
import Schedule from "./pages/Schedule.js";
import Wishlist from "./pages/Wishlist.js";
import PrivacyPolicy from "./pages/PrivacyPolicy.js";
import FAQ from "./pages/FAQ.js";
import AboutUs from "./pages/AboutUs.js";
import AiChat from "./pages/AiChat.js";
import AdminLayout from "./pages/admin/AdminLayout.js";
import AdminSync from "./pages/admin/AdminSync.js";
import AdminAiTrainer from "./pages/admin/AdminAiTrainer.js";
import AdminSystem from "./pages/admin/AdminSystem.js";
import AdminStats from "./pages/admin/AdminStats.js";
import AdminUsers from "./pages/admin/AdminUsers.js";
import AdminLogs from "./pages/admin/AdminLogs.js";
import AdminInviteCodes from "./pages/admin/AdminInviteCodes.js";
import Footer from "./components/layout/Footer.js";
import AdminFeedback from "./pages/admin/AdminFeedback.js";
import FeedbackHubLayout from "./pages/feedbackHub/FeedbackHubLayout.js";
import FeedbackHubRoadmap from "./pages/feedbackHub/FeedbackHubRoadmap.js";
import FeedbackHubBoard from "./pages/feedbackHub/FeedbackHubBoard.js";
import FeedbackHubPostDetail from "./pages/feedbackHub/FeedbackHubPostDetail.js";
import FeedbackHubChangelog from "./pages/feedbackHub/FeedbackHubChangelog.js";
import OnboardingProvider from "./components/onboarding/OnboardingProvider.js";

function getSafeInternalNext(rawNext: string | null): string | null {
  if (!rawNext) return null;
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return null;
  return rawNext;
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginRoute user={user} />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/catalog/:id" element={<CourseDetail />} />
        <Route
          path="/ai"
          element={<AiChat />}
        />
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
        <AppRoutes user={user} />
        {!isLoginRoute && <Footer />}
      </div>
    </OnboardingProvider>
  );
}
