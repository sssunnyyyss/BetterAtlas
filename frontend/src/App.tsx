import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Feedback from "./pages/Feedback.js";
import AdminLayout from "./pages/admin/AdminLayout.js";
import AdminSync from "./pages/admin/AdminSync.js";
import AdminAiTrainer from "./pages/admin/AdminAiTrainer.js";
import AdminSystem from "./pages/admin/AdminSystem.js";
import AdminStats from "./pages/admin/AdminStats.js";
import AdminUsers from "./pages/admin/AdminUsers.js";
import AdminLogs from "./pages/admin/AdminLogs.js";
import AdminInviteCodes from "./pages/admin/AdminInviteCodes.js";
import OnboardingProvider from "./components/onboarding/OnboardingProvider.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/profile" replace />;
  return <>{children}</>;
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
      <OnboardingProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Landing />} />
          <Route
            path="/catalog"
            element={
              <ProtectedRoute>
                <Catalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalog/:id"
            element={
              <ProtectedRoute>
                <CourseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/professors/:id"
            element={
              <ProtectedRoute>
                <ProfessorDetail />
              </ProtectedRoute>
            }
          />
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
            <Route path="logs" element={<AdminLogs />} />
          </Route>
          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <Feedback />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OnboardingProvider>
    </BrowserRouter>
  );
}
