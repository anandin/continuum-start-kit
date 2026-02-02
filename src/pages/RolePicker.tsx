import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';
import { Briefcase, Search, Loader2 } from 'lucide-react';

export default function RolePicker() {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'provider' | 'seeker' | null>(null);
  const { user, role, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (role) {
      navigate('/dashboard');
    }
  }, [user, role, navigate]);

  const handleRoleSelection = async (role: 'provider' | 'seeker') => {
    if (!user) {
      toast.error('You must be logged in');
      navigate('/auth');
      return;
    }

    setLoading(true);
    setSelectedRole(role);

    try {
      const res = await apiRequest('POST', '/api/user/role', { role });
      const data = await res.json();

      await refreshProfile();
      toast.success(`Welcome as a ${role}!`);
      
      if (role === 'provider') {
        navigate('/provider/setup');
      } else {
        navigate('/onboarding');
      }
    } catch (error: any) {
      console.error('Role selection error:', error);
      toast.error(error.message || 'Failed to set role');
    } finally {
      setLoading(false);
      setSelectedRole(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4">
      <Card className="w-full max-w-2xl bg-slate-900/50 border-white/10 backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold mb-2 text-white">Choose Your Role</CardTitle>
          <CardDescription className="text-slate-300">
            Select how you'd like to use Haven. You can change this later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <button
              onClick={() => handleRoleSelection('provider')}
              disabled={loading}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/10 bg-slate-900/50 p-8 text-left transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="button-select-provider"
            >
              <div className="relative z-10">
                <div className="mb-4 rounded-full bg-purple-500/10 p-4 w-fit group-hover:bg-purple-500/20 transition-colors">
                  <Briefcase className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">Provider</h3>
                <p className="text-sm text-slate-400">
                  Offer services, products, or expertise to seekers on the platform.
                </p>
              </div>
              {loading && selectedRole === 'provider' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              )}
            </button>

            <button
              onClick={() => handleRoleSelection('seeker')}
              disabled={loading}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/10 bg-slate-900/50 p-8 text-left transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="button-select-seeker"
            >
              <div className="relative z-10">
                <div className="mb-4 rounded-full bg-purple-500/10 p-4 w-fit group-hover:bg-purple-500/20 transition-colors">
                  <Search className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">Seeker</h3>
                <p className="text-sm text-slate-400">
                  Find and connect with providers to meet your needs and goals.
                </p>
              </div>
              {loading && selectedRole === 'seeker' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
