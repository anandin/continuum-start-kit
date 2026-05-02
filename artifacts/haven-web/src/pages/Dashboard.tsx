import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProviderDashboardView } from '@/components/dashboard/ProviderDashboardView';
import { SeekerDashboardView } from '@/components/dashboard/SeekerDashboardView';
import { AppLayout } from '@/components/AppLayout';

export default function Dashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (!role) {
        navigate('/auth/role');
      } else if (role === 'provider') {
        // Coaches land in the triage Inbox by default; the legacy dashboard
        // (client list, twin tower, stats) still lives at /provider/dashboard.
        navigate('/provider/inbox', { replace: true });
      }
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm-hero">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your space...</p>
        </div>
      </div>
    );
  }

  if (!user || !role) return null;

  return (
    <AppLayout
      title={role === 'provider' ? 'Coach Dashboard' : 'Your Journey'}
      subtitle={role === 'provider' ? 'Your practice at a glance' : 'Welcome back'}
    >
      {role === 'provider' ? (
        <ProviderDashboardView userId={user.id} />
      ) : (
        <SeekerDashboardView userId={user.id} />
      )}
    </AppLayout>
  );
}
