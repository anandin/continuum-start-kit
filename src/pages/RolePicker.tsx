import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { toast } from 'sonner';
import { Heart, Compass, Loader2, Sparkles } from 'lucide-react';

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
      toast.success(
        role === 'provider'
          ? 'Welcome! Let\'s set up your coaching practice.'
          : 'Welcome! Let\'s find the right support for you.'
      );
      
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm-hero px-4 dark:bg-background">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center gap-1">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-role-title">
            How would you like to use Haven?
          </h1>
          <p className="text-muted-foreground" data-testid="text-role-description">
            Choose the path that feels right for you. There's no wrong answer.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card
            className={`cursor-pointer transition-all hover-elevate active-elevate-2 ${
              loading && selectedRole !== 'provider' ? 'opacity-50 pointer-events-none' : ''
            }`}
            onClick={() => !loading && handleRoleSelection('provider')}
            data-testid="button-select-provider"
          >
            <CardHeader className="gap-2">
              <div className="rounded-md bg-primary/10 p-3 w-fit">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Coach or Guide</CardTitle>
              <CardDescription>
                Share your expertise and help others grow. Set up your practice, customize your AI coaching agent, and support seekers on their journey.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  Create your coaching profile
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  Configure an AI-powered coaching agent
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  Track client progress and insights
                </li>
              </ul>
              {loading && selectedRole === 'provider' && (
                <div className="mt-4 flex items-center justify-center gap-2 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Setting up your space...</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover-elevate active-elevate-2 ${
              loading && selectedRole !== 'seeker' ? 'opacity-50 pointer-events-none' : ''
            }`}
            onClick={() => !loading && handleRoleSelection('seeker')}
            data-testid="button-select-seeker"
          >
            <CardHeader className="gap-2">
              <div className="rounded-md bg-accent/15 p-3 w-fit">
                <Compass className="h-6 w-6 text-accent" />
              </div>
              <CardTitle className="text-xl">Seeker</CardTitle>
              <CardDescription>
                Find the support you deserve. Connect with a coach who understands your goals and start meaningful conversations that lead to real growth.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  Get matched with the right coach
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  Have guided coaching conversations
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  See your growth over time
                </li>
              </ul>
              {loading && selectedRole === 'seeker' && (
                <div className="mt-4 flex items-center justify-center gap-2 text-accent">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Preparing your journey...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
