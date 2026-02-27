import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2, Leaf } from 'lucide-react';
import { ProviderDashboardView } from '@/components/dashboard/ProviderDashboardView';
import { SeekerDashboardView } from '@/components/dashboard/SeekerDashboardView';

export default function Dashboard() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm-hero">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your space...</p>
        </div>
      </div>
    );
  }

  if (!user || !role) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-warm-hero">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Leaf className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground" data-testid="text-app-title">Haven</h1>
              <p className="text-xs text-muted-foreground capitalize" data-testid="text-role-label">
                {role === 'provider' ? 'Coach Dashboard' : 'Your Journey'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-signout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

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
