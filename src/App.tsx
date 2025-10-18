import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import RolePicker from "./pages/RolePicker";
import Dashboard from "./pages/Dashboard";
import ProviderSetup from "./pages/ProviderSetup";
import Onboarding from "./pages/Onboarding";
import Chat from "./pages/Chat";
import SessionSummary from "./pages/SessionSummary";
import Health from "./pages/Health";
import NotFound from "./pages/NotFound";
import ProviderDashboard from "./pages/ProviderDashboard";
import ProviderEngagement from "./pages/ProviderEngagement";
import ClientSessionSummary from "./pages/ClientSessionSummary";
import AgentSetup from "./pages/AgentSetup";
import CreateTestUsers from "./pages/CreateTestUsers";
import ManualTestRunner from "./tests/manual-test-runner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/health" element={<Health />} />
            <Route path="/test-runner" element={<ManualTestRunner />} />
            <Route path="/create-test-users" element={<CreateTestUsers />} />
            <Route
              path="/auth/role"
              element={
                <ProtectedRoute>
                  <RolePicker />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/setup"
              element={
                <ProtectedRoute>
                  <ProviderSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/agent-setup"
              element={
                <ProtectedRoute>
                  <AgentSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:sessionId"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/session-summary/:sessionId"
              element={
                <ProtectedRoute>
                  <SessionSummary />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/dashboard"
              element={
                <ProtectedRoute>
                  <ProviderDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/engagement/:engagementId"
              element={
                <ProtectedRoute>
                  <ProviderEngagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/client/:clientId"
              element={
                <ProtectedRoute>
                  <ClientSessionSummary />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
