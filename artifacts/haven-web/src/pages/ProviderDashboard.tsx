import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ProviderDashboardView } from "@/components/dashboard/ProviderDashboardView";

export default function ProviderDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth");
      } else if (!role) {
        navigate("/auth/role");
      } else if (role !== "provider") {
        navigate("/dashboard");
      }
    }
  }, [user, role, loading, navigate]);

  if (loading || !user || role !== "provider") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout title="Coach Dashboard" subtitle="Your practice at a glance">
      <ProviderDashboardView userId={user.id} />
    </AppLayout>
  );
}
