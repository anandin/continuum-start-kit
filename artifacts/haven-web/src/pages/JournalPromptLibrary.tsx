import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { BookText, Plus, Archive, Pencil, Globe, User, Users } from 'lucide-react';

interface JournalPrompt {
  id: string;
  providerId: string | null;
  engagementId: string | null;
  text: string;
  category: string | null;
  isArchived: boolean;
  createdAt: string;
}

interface EngagementSummary {
  id: string;
  seekerName?: string | null;
  status?: string | null;
}

const CATEGORIES = ['general', 'daily', 'weekly', 'session-prep'];

export default function JournalPromptLibrary() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<JournalPrompt | null>(null);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('general');
  const [engagementId, setEngagementId] = useState<string>('all');

  const promptsQ = useQuery<JournalPrompt[]>({
    queryKey: ['/api/journal/prompts'],
    queryFn: async () => {
      const res = await fetch('/api/journal/prompts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load prompts');
      return res.json();
    },
  });

  const engagementsQ = useQuery<EngagementSummary[]>({
    queryKey: ['/api/engagements'],
    queryFn: async () => {
      const res = await fetch('/api/engagements', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load engagements');
      return res.json();
    },
  });

  const resetForm = () => {
    setText('');
    setCategory('general');
    setEngagementId('all');
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setComposerOpen(true);
  };

  const openEdit = (p: JournalPrompt) => {
    setEditing(p);
    setText(p.text);
    setCategory(p.category ?? 'general');
    setEngagementId(p.engagementId ?? 'all');
    setComposerOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/journal/prompts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          category,
          engagementId: engagementId === 'all' ? null : engagementId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Prompt added' });
      qc.invalidateQueries({ queryKey: ['/api/journal/prompts'] });
      setComposerOpen(false);
      resetForm();
    },
    onError: (e: Error) =>
      toast({
        title: "Couldn't add",
        description: e.message,
        variant: 'destructive',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; data: Partial<JournalPrompt> }) => {
      const res = await fetch(`/api/journal/prompts/${payload.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/journal/prompts'] });
      setComposerOpen(false);
      resetForm();
    },
    onError: (e: Error) =>
      toast({
        title: "Couldn't save",
        description: e.message,
        variant: 'destructive',
      }),
  });

  const handleSave = () => {
    if (text.trim().length < 3) {
      toast({ title: 'Prompt is too short', variant: 'destructive' });
      return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          text: text.trim(),
          category,
          engagementId: engagementId === 'all' ? null : engagementId,
        },
      });
    } else {
      createMutation.mutate();
    }
  };

  const handleArchive = (p: JournalPrompt) => {
    updateMutation.mutate({ id: p.id, data: { isArchived: true } });
  };

  const prompts = promptsQ.data ?? [];
  const engagements = engagementsQ.data ?? [];

  const starters = prompts.filter((p) => !p.providerId);
  const myLibrary = prompts.filter((p) => p.providerId && !p.engagementId);
  const clientSpecific = prompts.filter((p) => p.providerId && p.engagementId);

  const engagementLabel = (id: string) => {
    const e = engagements.find((x) => x.id === id);
    return e?.seekerName ?? 'Client';
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BookText className="h-6 w-6" />
              Journal prompts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Curate reflection prompts your clients can pick from. Add custom
              prompts for everyone or assign one to a specific client.
            </p>
          </div>
          <Button onClick={openNew} data-testid="prompt-new">
            <Plus className="h-4 w-4 mr-1.5" />
            New prompt
          </Button>
        </div>

        {promptsQ.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <PromptSection
              title="Starter set"
              description="Built-in prompts visible to every client. Read-only."
              icon={<Globe className="h-4 w-4" />}
              prompts={starters}
              renderActions={() => null}
            />
            <PromptSection
              title="My library"
              description="Custom prompts available to all of your clients."
              icon={<User className="h-4 w-4" />}
              prompts={myLibrary}
              renderActions={(p) => (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(p)}
                    data-testid={`prompt-edit-${p.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchive(p)}
                    data-testid={`prompt-archive-${p.id}`}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            />
            <PromptSection
              title="Client-specific"
              description="Prompts assigned to a single client engagement."
              icon={<Users className="h-4 w-4" />}
              prompts={clientSpecific}
              extraBadge={(p) =>
                p.engagementId ? engagementLabel(p.engagementId) : null
              }
              renderActions={(p) => (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(p)}
                    data-testid={`prompt-edit-${p.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchive(p)}
                    data-testid={`prompt-archive-${p.id}`}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            />
          </>
        )}
      </div>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit prompt' : 'New prompt'}</DialogTitle>
            <DialogDescription>
              Prompts seed entries in the client's journal. Keep them open-ended
              and inviting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prompt-text">Prompt text</Label>
              <Textarea
                id="prompt-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="What helped you feel grounded this week?"
                data-testid="prompt-text-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prompt-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="prompt-category" data-testid="prompt-category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt-engagement">Visible to</Label>
                <Select value={engagementId} onValueChange={setEngagementId}>
                  <SelectTrigger id="prompt-engagement" data-testid="prompt-engagement-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All my clients</SelectItem>
                    {engagements.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.seekerName ?? `Client ${e.id.slice(0, 6)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="prompt-save"
            >
              {editing ? 'Save changes' : 'Add prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

interface PromptSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  prompts: JournalPrompt[];
  extraBadge?: (p: JournalPrompt) => string | null;
  renderActions: (p: JournalPrompt) => React.ReactNode;
}

function PromptSection({
  title,
  description,
  icon,
  prompts,
  extraBadge,
  renderActions,
}: PromptSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          <span className="text-xs font-normal text-muted-foreground">
            ({prompts.length})
          </span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {prompts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No prompts yet.</p>
        ) : (
          <ul className="divide-y">
            {prompts.map((p) => {
              const extra = extraBadge?.(p);
              return (
                <li
                  key={p.id}
                  className="py-3 flex items-start gap-4"
                  data-testid={`prompt-row-${p.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{p.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {p.category ? (
                        <Badge variant="outline" className="text-[10px]">
                          {p.category}
                        </Badge>
                      ) : null}
                      {extra ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {extra}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">{renderActions(p)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
