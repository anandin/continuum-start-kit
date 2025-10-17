import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import { ProviderDashboardView } from '@/components/dashboard/ProviderDashboardView';
import { SeekerDashboardView } from '@/components/dashboard/SeekerDashboardView';

export default function Dashboard() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  // Redirect logic in useEffect to avoid render-phase navigation
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (!role) {
        navigate('/auth/role');
      }
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!user || !role) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                Bloom
              </span>
            </h1>
            <p className="text-sm text-slate-400 capitalize">
              {role} Dashboard
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="border-white/20 bg-white/5 text-white hover:bg-white/10">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {role === 'provider' ? (
            <ProviderDashboardView userId={user.id} />
          ) : (
            <SeekerDashboardView userId={user.id} />
          )}
        </div>
      </main>
    </div>
  );
}
