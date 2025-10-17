import { useState } from 'react';
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
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelection = async (role: 'provider' | 'seeker') => {
    if (!user) {
      toast.error('You must be logged in');
      navigate('/auth');
      return;
    }

    setLoading(true);
    setSelectedRole(role);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success(`Welcome as a ${role}!`);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Role selection error:', error);
      toast.error(error.message || 'Failed to set role');
    } finally {
      setLoading(false);
      setSelectedRole(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold mb-2">Choose Your Role</CardTitle>
          <CardDescription>
            Select how you'd like to use Continuum. You can change this later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <button
              onClick={() => handleRoleSelection('provider')}
              disabled={loading}
              className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-8 text-left transition-all hover:border-primary hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="relative z-10">
                <div className="mb-4 rounded-full bg-primary/10 p-4 w-fit group-hover:bg-primary/20 transition-colors">
                  <Briefcase className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Provider</h3>
                <p className="text-sm text-muted-foreground">
                  Offer services, products, or expertise to seekers on the platform.
                </p>
              </div>
              {loading && selectedRole === 'provider' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </button>

            <button
              onClick={() => handleRoleSelection('seeker')}
              disabled={loading}
              className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-8 text-left transition-all hover:border-primary hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="relative z-10">
                <div className="mb-4 rounded-full bg-primary/10 p-4 w-fit group-hover:bg-primary/20 transition-colors">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Seeker</h3>
                <p className="text-sm text-muted-foreground">
                  Find and connect with providers to meet your needs and goals.
                </p>
              </div>
              {loading && selectedRole === 'seeker' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
