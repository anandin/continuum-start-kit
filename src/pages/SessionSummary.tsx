import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowRight, CheckCircle, TrendingUp, TrendingDown, Activity, AlertTriangle, ArrowLeft } from 'lucide-react';
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
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && sessionId) {
      loadSummary();
    }
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
      
      // If no summary exists yet
      if (!summaryData) {
        if (sessionData.status === 'active') {
          // Session still active - can't generate summary yet
          toast.info('This session is still active. End it to generate a summary.');
          navigate(`/chat/${sessionId}`);
        } else {
          // Session ended but no summary - offer to generate
          setSummary(null);
        }
        setLoading(false);
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

  const handleGenerateSummary = async () => {
    if (!sessionId) return;
    
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('session-finish', {
        body: { sessionId }
      });

      if (error) throw error;

      toast.success('Summary generated successfully!');
      await loadSummary();
    } catch (error: any) {
      console.error('Error generating summary:', error);
      toast.error(error.message || 'Failed to generate summary');
    } finally {
      setCreating(false);
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
      case 'accelerating': return <TrendingUp className="h-5 w-5 text-emerald-600" />;
      case 'steady': return <Activity className="h-5 w-5 text-sky-600" />;
      case 'drifting': return <TrendingDown className="h-5 w-5 text-amber-600" />;
      case 'stalling': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getTrajectoryColor = (status: string) => {
    switch (status) {
      case 'accelerating': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'steady': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'drifting': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'stalling': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!summary && !creating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50">
        <header className="border-b border-sky-200 bg-white/80 backdrop-blur-lg shadow-sm">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-2xl font-bold text-indigo-900">Session Summary</h1>
              <p className="text-sm text-slate-600">No summary available yet</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')} 
              className="border-sky-300 bg-white text-indigo-900 hover:bg-sky-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl">
            <Card className="bg-white border-sky-200 shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-indigo-900 mb-2">Summary Not Available</CardTitle>
                <CardDescription className="text-slate-600">
                  {session?.status === 'active' 
                    ? 'This session is still active. End the session to generate a summary.'
                    : 'This session has ended but no summary has been generated yet.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {session?.status === 'ended' && (
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={creating}
                    className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Summary...
                      </>
                    ) : (
                      'Generate Summary'
                    )}
                  </Button>
                )}
                {session?.status === 'active' && (
                  <Button
                    onClick={() => navigate(`/chat/${sessionId}`)}
                    className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white"
                  >
                    Back to Chat
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50">
      <header className="border-b border-sky-200 bg-white/80 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
              Session Complete
            </h1>
            <p className="text-sm text-slate-600">
              Completed {new Date(session.ended_at || session.started_at).toLocaleDateString()}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')} 
            className="border-sky-300 bg-white text-indigo-900 hover:bg-sky-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Status Card */}
          <Card className="bg-white border-sky-200 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-indigo-900">Session Completed Successfully</CardTitle>
                    <CardDescription className="text-slate-600">
                      Your progress has been analyzed and saved
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTrajectoryIcon(summary.trajectory_status)}
                  <Badge variant="outline" className={getTrajectoryColor(summary.trajectory_status)}>
                    {summary.trajectory_status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Current Stage */}
          <Card className="bg-white border-sky-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-indigo-900">Next Stage</CardTitle>
              <CardDescription className="text-slate-600">Based on your progress in this session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-sky-50 p-6 border-2 border-indigo-200">
                <p className="text-2xl font-bold text-indigo-900">{summary.assigned_stage}</p>
              </div>
            </CardContent>
          </Card>

          {/* Session Summary */}
          <Card className="bg-white border-sky-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-indigo-900">Session Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                {summary.session_summary}
              </p>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <Card className="bg-white border-sky-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-indigo-900">Key Insights</CardTitle>
              <CardDescription className="text-slate-600">Important patterns and observations</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {Array.isArray(summary.key_insights) && summary.key_insights.map((insight: any, index: number) => (
                  <li key={index} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-indigo-600 flex-shrink-0" />
                    <p className="text-slate-700">{typeof insight === 'string' ? insight : insight.insight}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Next Action */}
          <Card className="bg-white border-sky-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-indigo-900">Next Action</CardTitle>
              <CardDescription className="text-slate-600">Your recommended next step</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-sky-50 p-6">
                <p className="font-medium text-indigo-900">{summary.next_action}</p>
              </div>
            </CardContent>
          </Card>

          <Separator className="bg-sky-200" />

          {/* Actions */}
          <div className="flex gap-4">
            <Button 
              onClick={handleStartNextSession} 
              disabled={creating}
              size="lg"
              className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow-lg"
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
              className="border-sky-300 bg-white text-indigo-900 hover:bg-sky-50"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}