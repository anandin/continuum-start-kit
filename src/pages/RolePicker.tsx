import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Briefcase, Search, Loader2 } from 'lucide-react';

export default function RolePicker() {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'provider' | 'seeker' | null>(null);
  const { user, role, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Redirect if user already has a role
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (role) {
      // User already has a role, redirect to dashboard
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
      // Check if user already has a role
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      // PGRST116 means no rows found - this is okay, user needs to select a role
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Check role error:', checkError);
        throw checkError;
      }

      if (existingRole) {
        // Role already exists, just refresh and navigate
        console.log('Role already exists:', existingRole.role);
        await refreshProfile();
        toast.success(`Welcome back!`);
        navigate('/dashboard');
        return;
      }

      // Insert new role (unique constraint ensures only one per user)
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role });

      if (insertError) {
        // 23505 is unique violation - user already has a role
        if (insertError.code === '23505') {
          await refreshProfile();
          toast.success(`Welcome back!`);
          navigate('/dashboard');
          return;
        }
        console.error('Insert role error:', insertError);
        throw insertError;
      }

      console.log('Role inserted successfully:', role);
      await refreshProfile();
      toast.success(`Welcome as a ${role}!`);
      
      // Redirect new users to setup pages
      if (role === 'provider') {
        navigate('/provider-setup');
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
            Select how you'd like to use Bloom. You can change this later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <button
              onClick={() => handleRoleSelection('provider')}
              disabled={loading}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/10 bg-slate-900/50 p-8 text-left transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
