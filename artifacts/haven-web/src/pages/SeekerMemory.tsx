import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Brain, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MemoryEntry {
  id: string;
  engagementId: string;
  kind: string;
  content: string;
  importance: number | null;
  createdAt: string;
  redactedAt: string | null;
}

export default function SeekerMemory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [target, setTarget] = useState<MemoryEntry | null>(null);
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void load();
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const res = await apiRequest('GET', '/api/seeker/memory');
      const rows = (await res.json()) as MemoryEntry[];
      setEntries(rows);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load memory');
    } finally {
      setLoading(false);
    }
  }

  async function forget() {
    if (!target) return;
    setForgetting(true);
    try {
      await apiRequest('POST', `/api/seeker/memory/${target.id}/redact`);
      setEntries((prev) => prev.filter((e) => e.id !== target.id));
      toast.success('Forgotten');
    } catch (err: any) {
      toast.error(err?.message || 'Could not forget entry');
    } finally {
      setForgetting(false);
      setTarget(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Manage memory</h1>
            <p className="text-xs text-muted-foreground">
              Everything your twin remembers about you. Forget anything, anytime.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <Card className="shadow-warm">
            <CardHeader className="items-center text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Nothing remembered yet</CardTitle>
              <CardDescription>
                After your sessions, the twin may save short notes here so it can pick up where
                you left off. You'll see them as soon as they're written.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          entries.map((e) => (
            <Card key={e.id} className="shadow-warm" data-testid={`memory-${e.id}`}>
              <CardContent className="py-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">{e.kind}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{e.content}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTarget(e)}
                  data-testid={`button-forget-${e.id}`}
                  aria-label="Forget this"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              Your twin won't use this in future sessions. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-forget">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={forget}
              disabled={forgetting}
              data-testid="button-confirm-forget"
            >
              {forgetting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Forget'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
