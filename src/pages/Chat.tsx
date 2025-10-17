import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function Chat() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadSession();
  }, [user, sessionId]);

  const loadSession = async () => {
    if (!sessionId) {
      toast.error('No session ID provided');
      navigate('/dashboard');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          engagement:engagements (
            id,
            seeker:seekers (
              id,
              owner_id
            ),
            provider:profiles!engagements_provider_id_fkey (
              id,
              email
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      if (!data) {
        toast.error('Session not found');
        navigate('/dashboard');
        return;
      }

      setSession(data);
    } catch (error: any) {
      console.error('Error loading session:', error);
      toast.error('Failed to load session');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Continuum Chat
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Session started {new Date(session.started_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                Chat Interface
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center">
                <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Chat Coming Soon</h3>
                <p className="text-muted-foreground mb-4">
                  The chat interface will be implemented in the next phase.
                </p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Session ID:</strong> {session.id}</p>
                  <p><strong>Initial Stage:</strong> {session.initial_stage}</p>
                  <p><strong>Status:</strong> {session.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
