import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowRight, CheckCircle, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SessionSummary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadSummary();
  }, [user, sessionId]);

  const loadSummary = async () => {
    if (!sessionId) {
      toast.error('No session ID provided');
      navigate('/dashboard');
      return;
    }

    setLoading(true);
    try {
      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          engagement:engagements (
            id,
            provider_id,
            seeker_id
          )
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error('Session not found');
      setSession(sessionData);

      // Load summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('summaries')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (summaryError) throw summaryError;
      if (!summaryData) {
        toast.error('Summary not found for this session');
        navigate('/dashboard');
        return;
      }

      setSummary(summaryData);
    } catch (error: any) {
      console.error('Error loading summary:', error);
      toast.error(error.message || 'Failed to load summary');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNextSession = async () => {
    if (!session || !summary) return;

    setCreating(true);
    try {
      // Create new session with assigned_stage from summary
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          engagement_id: session.engagement_id,
          status: 'active',
          initial_stage: summary.assigned_stage,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      toast.success('New session started!');
      navigate(`/chat/${newSession.id}`);
    } catch (error: any) {
      console.error('Error creating next session:', error);
      toast.error(error.message || 'Failed to start next session');
    } finally {
      setCreating(false);
    }
  };

  const getTrajectoryIcon = (status: string) => {
    switch (status) {
      case 'accelerating': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'steady': return <Activity className="h-5 w-5 text-blue-500" />;
      case 'drifting': return <TrendingDown className="h-5 w-5 text-yellow-500" />;
      case 'stalling': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getTrajectoryColor = (status: string) => {
    switch (status) {
      case 'accelerating': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'steady': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'drifting': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'stalling': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Session Summary
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Completed {new Date(session.ended_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <CardTitle>Session Completed</CardTitle>
                    <CardDescription>
                      Your progress has been analyzed and saved
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTrajectoryIcon(summary.trajectory_status)}
                  <Badge className={getTrajectoryColor(summary.trajectory_status)}>
                    {summary.trajectory_status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Current Stage */}
          <Card>
            <CardHeader>
              <CardTitle>Current Stage</CardTitle>
              <CardDescription>Based on your progress in this session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-primary/10 p-4">
                <p className="text-2xl font-bold text-primary">{summary.assigned_stage}</p>
              </div>
            </CardContent>
          </Card>

          {/* Session Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Session Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {summary.session_summary}
              </p>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
              <CardDescription>Important patterns and observations</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {Array.isArray(summary.key_insights) && summary.key_insights.map((insight: string, index: number) => (
                  <li key={index} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    <p className="text-muted-foreground">{insight}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Next Action */}
          <Card>
            <CardHeader>
              <CardTitle>Next Action</CardTitle>
              <CardDescription>Your recommended next step</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <p className="font-medium text-foreground">{summary.next_action}</p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Actions */}
          <div className="flex gap-4">
            <Button 
              onClick={handleStartNextSession} 
              disabled={creating}
              size="lg"
              className="flex-1"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Start Next Session
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              size="lg"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
