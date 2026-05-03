import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Send,
  ArrowLeft,
  MoreVertical,
  RefreshCw,
  History,
  Heart,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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

interface MessageAttachment {
  id: string;
  kind: 'image' | 'audio';
  mime: string;
  durationS?: number | null;
  transcript?: string | null;
}

interface Message {
  id: string;
  role: 'seeker' | 'agent' | 'provider';
  content: string;
  createdAt: string;
  created_at?: string;
  redactedAt?: string | null;
  attachments?: MessageAttachment[];
}

/**
 * Resolves a short-lived signed GCS URL for a single attachment and
 * renders it inline. Coaches viewing the conversation on web see photos
 * full-bleed and can play voice memos with the auto-generated
 * transcript shown beneath the player.
 */
function AttachmentView({ att }: { att: MessageAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attachments/${att.id}/url`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json();
      })
      .then((data: { url: string }) => {
        if (!cancelled) setUrl(data.url);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load attachment');
      });
    return () => {
      cancelled = true;
    };
  }, [att.id]);

  if (error) {
    return <p className="text-xs italic opacity-70 mt-2">{error}</p>;
  }

  if (att.kind === 'image') {
    return (
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2"
        data-testid={`attachment-image-${att.id}`}
      >
        {url ? (
          <img
            src={url}
            alt="Shared photo"
            className="max-h-72 max-w-full rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="w-48 h-48 rounded-lg bg-muted animate-pulse" />
        )}
      </a>
    );
  }

  return (
    <div className="mt-2 space-y-1" data-testid={`attachment-audio-${att.id}`}>
      {url ? (
        <audio controls preload="none" src={url} className="w-full max-w-xs">
          Your browser does not support audio playback.
        </audio>
      ) : (
        <div className="h-10 w-full max-w-xs rounded-full bg-muted animate-pulse" />
      )}
      {!att.transcript ? (
        <p className="text-xs italic opacity-60">Voice memo (no transcript)</p>
      ) : null}
    </div>
  );
}

export default function Chat() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [providerConfig, setProviderConfig] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isProviderViewing, setIsProviderViewing] = useState(false);
  const [redactTarget, setRedactTarget] = useState<Message | null>(null);
  const [redacting, setRedacting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && sessionId) {
      loadSession();
      loadMessages();
    }
  }, [user, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSession = async () => {
    if (!sessionId) {
      toast.error('No session ID provided');
      navigate('/dashboard');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Session not found');
      const data = await res.json();
      setSession(data);

      if (data.engagementId) {
        const engRes = await fetch(`/api/engagements/${data.engagementId}`, { credentials: 'include' });
        if (engRes.ok) {
          const engagement = await engRes.json();
          if (engagement.providerId) {
            // Provider supervisor view: sending disabled (Twin replies on their behalf).
            if (user && user.id === engagement.providerId) {
              setIsProviderViewing(true);
            }
            const configs = await fetch('/api/provider-configs', { credentials: 'include' });
            if (configs.ok) {
              const allConfigs = await configs.json();
              const config = allConfigs.find((c: any) => c.providerId === engagement.providerId);
              if (config) setProviderConfig(config);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading session:', error);
      toast.error('Failed to load session');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending || !sessionId) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'seeker',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await apiRequest('POST', '/api/chat', { sessionId, message: userMessage });
      const data = await res.json();

      await loadMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleNewSession = async () => {
    if (!session?.engagementId) return;

    try {
      const res = await apiRequest('POST', '/api/sessions', {
        engagementId: session.engagementId,
        initialStage: session.initialStage,
      });
      const newSession = await res.json();
      toast.success('Started a new session');
      navigate(`/chat/${newSession.id}`);
    } catch (error: any) {
      console.error('Error creating new session:', error);
      toast.error('Failed to create new session');
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      const res = await apiRequest('POST', `/api/sessions/${sessionId}/finish`);
      const data = await res.json();

      toast.success('Session complete');
      if (data?.summary?.id) {
        navigate(`/session-summary/${sessionId}`);
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
    setShowEndDialog(false);
  };

  const getMessageTime = (msg: Message) => {
    const ts = msg.createdAt || msg.created_at;
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" data-testid="chat-loading">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Preparing your space...</p>
        </div>
      </div>
    );
  }

  const isEnded = session?.status === 'ended';

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="chat-page">
      <div className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border shadow-warm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3 flex-wrap">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {providerConfig?.title?.charAt(0) || 'H'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-sm font-semibold text-foreground" data-testid="text-session-title">
                    {providerConfig?.title || 'Coaching Session'}
                  </h1>
                  {session?.initialStage && (
                    <p className="text-xs text-muted-foreground" data-testid="text-session-stage">{session.initialStage}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isEnded ? 'secondary' : 'default'} data-testid="badge-session-status">
                {isEnded ? 'Completed' : 'Active'}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-chat-menu">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={handleNewSession} className="cursor-pointer" data-testid="menu-new-session">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    New Session
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer" data-testid="menu-view-history">
                    <History className="mr-2 h-4 w-4" />
                    View History
                  </DropdownMenuItem>
                  {!isEnded && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowEndDialog(true)}
                        className="text-destructive cursor-pointer focus:text-destructive"
                        data-testid="menu-end-session"
                      >
                        End Session
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {messages.length === 0 ? (
            <div className="text-center py-20" data-testid="chat-empty-state">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-5">
                <Heart className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Welcome to your safe space</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                Take your time. Share whatever feels right. Your coach is here to listen and guide you on your journey.
              </p>
            </div>
          ) : (
            <>
              {messages
                // Spec: redacted messages disappear entirely from the
                // seeker's transcript; only the coach sees the
                // "redacted at HH:MM" placeholder as a transcript gap.
                .filter((message) => isProviderViewing || !message.redactedAt)
                .map((message) => {
                const isOwnSeekerMsg =
                  message.role === 'seeker' && !isProviderViewing && !message.redactedAt;
                const redactedTime = message.redactedAt
                  ? new Date(message.redactedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null;
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'seeker' ? 'flex-row-reverse' : 'flex-row'}`}
                    data-testid={`message-${message.role}-${message.id}`}
                    onContextMenu={
                      isOwnSeekerMsg
                        ? (e) => {
                            e.preventDefault();
                            setRedactTarget(message);
                          }
                        : undefined
                    }
                  >
                    {message.role !== 'seeker' && (
                      <Avatar className="h-8 w-8 border border-border flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {providerConfig?.title?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                        message.redactedAt
                          ? 'bg-muted text-muted-foreground border border-dashed border-border italic'
                          : message.role === 'seeker'
                            ? 'bg-primary text-primary-foreground shadow-warm'
                            : 'bg-card text-card-foreground border border-border shadow-warm'
                      }`}
                    >
                      {message.redactedAt ? (
                        <p className="text-sm" data-testid={`message-redacted-${message.id}`}>
                          Message redacted{redactedTime ? ` at ${redactedTime}` : ''}
                        </p>
                      ) : (
                        <>
                          {message.content ? (
                            <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
                          ) : null}
                          {message.attachments?.map((att) => (
                            <AttachmentView key={att.id} att={att} />
                          ))}
                          <p className={`text-xs mt-2 ${message.role === 'seeker' ? 'opacity-70' : 'text-muted-foreground'}`}>
                            {getMessageTime(message)}
                            {isOwnSeekerMsg ? ' · right-click to forget' : ''}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex gap-3" data-testid="typing-indicator">
                  <Avatar className="h-8 w-8 border border-border flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {providerConfig?.title?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card text-card-foreground border border-border rounded-2xl px-4 py-3 shadow-warm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">Reflecting...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="sticky bottom-0 z-50 border-t border-border bg-card/90 backdrop-blur-md shadow-warm p-4">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                isProviderViewing
                  ? 'Read-only — the twin replies on your behalf'
                  : isEnded
                    ? 'This session has ended'
                    : 'Share what\'s on your mind...'
              }
              disabled={sending || isEnded || isProviderViewing}
              className="flex-1 rounded-full px-5"
              data-testid="input-chat-message"
            />
            <Button
              type="submit"
              disabled={sending || !inputMessage.trim() || isEnded || isProviderViewing}
              className="rounded-full"
              data-testid="button-send-message"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {isProviderViewing ? (
            <p className="text-xs text-muted-foreground text-center mt-2">
              You're viewing this conversation as the supervising therapist. The AI twin responds on your behalf — direct sends are disabled to preserve attribution. Use the Review Queue or Calibration to shape the twin's responses.
            </p>
          ) : !isEnded ? (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Your conversation is private and secure
            </p>
          ) : null}
        </form>
      </div>

      <AlertDialog open={!!redactTarget} onOpenChange={(open) => !open && setRedactTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this message?</AlertDialogTitle>
            <AlertDialogDescription>
              Your coach will only see a "redacted" placeholder, and any memory the twin
              formed from this message will be forgotten too. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-redact">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!redactTarget) return;
                setRedacting(true);
                try {
                  await apiRequest('POST', `/api/messages/${redactTarget.id}/redact`);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === redactTarget.id
                        ? { ...m, content: '', redactedAt: new Date().toISOString() }
                        : m,
                    ),
                  );
                  toast.success('Message forgotten');
                } catch (err: any) {
                  toast.error(err?.message || 'Could not redact message');
                } finally {
                  setRedacting(false);
                  setRedactTarget(null);
                }
              }}
              disabled={redacting}
              data-testid="button-confirm-redact"
            >
              {redacting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Forget'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this session?</AlertDialogTitle>
            <AlertDialogDescription>
              Your conversation will be saved and a summary will be generated. You can always start a new session when you're ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-end">
              Keep Going
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSession}
              data-testid="button-confirm-end"
            >
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
