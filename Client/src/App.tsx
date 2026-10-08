import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useEffect } from "react";
import { AppProvider, useAuth } from "./store/AppStore";
import {
  UpgradeModalProvider,
  useUpgradeModal,
} from "./components/UpgradeModal";
import { DashboardLayout } from "./pages/DashboardLayout";
import { LandingPage } from "./pages/LandingPage";
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from "./pages/AuthPages";
import {
  VerifyEmailSentPage,
  EmailVerifiedPage,
} from "./pages/EmailVerificationPages";
import { Dashboard } from "./pages/TenantDashboard";
import { ContactsPage } from "./pages/ContactsPage";
import { GroupsPage } from "./pages/GroupsPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { MessagesPage } from "./pages/MessagesPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { BillingPage } from "./pages/BillingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WhatsAppPage } from "./pages/WhatsAppPage";
import { TemplateCreatePage } from "./pages/TemplateCreatePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import {
  AdminOverview,
  AdminUsersPage,
  AdminPlansPage,
  AdminSubscriptionsPage,
  AdminPaymentsPage,
  AdminAnalyticsPage,
} from "./pages/AdminPages";
import { ConversationsPage } from "./pages/ConversationsPage";
import { applyTheme } from "./lib/theme"; // ✅ sahi path

// Apply saved theme on boot (before first render)
const savedTheme = localStorage.getItem("engageo-theme") as
  | "dark"
  | "light"
  | null;
if (savedTheme) applyTheme(savedTheme);

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "admin" | "user";
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />
    );
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) {
    return (
      <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />
    );
  }
  return <>{children}</>;
}

// Listens for the custom plan-limit event from the API client
function PlanLimitListener() {
  const { showUpgrade } = useUpgradeModal();
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      showUpgrade(detail);
    };
    window.addEventListener("engageo:plan-limit", handler);
    return () => window.removeEventListener("engageo:plan-limit", handler);
  }, [showUpgrade]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <PlanLimitListener />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />

        {/* Email verification */}
        <Route path="/verify-email-sent" element={<VerifyEmailSentPage />} />
        <Route path="/verify-email" element={<EmailVerifiedPage />} />

        {/* Tenant routes */}
        <Route
          element={
            <ProtectedRoute requiredRole="user">
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route
            path="/whatsapp"
            element={<WhatsAppPage key="whatsapp-page" />}
          />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/create" element={<TemplateCreatePage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>

        {/* Admin routes */}
        <Route
          element={
            <ProtectedRoute requiredRole="admin">
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/plans" element={<AdminPlansPage />} />
          <Route
            path="/admin/subscriptions"
            element={<AdminSubscriptionsPage />}
          />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppProvider>
        <UpgradeModalProvider>
          <AppRoutes />
        </UpgradeModalProvider>
      </AppProvider>
    </Router>
  );
}

export default App;
