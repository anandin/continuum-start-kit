import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Send, 
  ArrowLeft, 
  MoreVertical,
  RefreshCw,
  Trash2,
  History,
  Sparkles
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

interface Message {
  id: string;
  role: 'seeker' | 'agent' | 'provider';
  content: string;
  created_at: string;
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
  const [streamingMessage, setStreamingMessage] = useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);
  
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
      setupRealtimeSubscription();
    }
  }, [user, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

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
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          engagement:engagements (
            id,
            provider_id,
            seeker:seekers (
              id,
              owner_id
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

      // Load provider config
      const { data: config } = await supabase
        .from('provider_configs')
        .select('*')
        .eq('provider_id', data.engagement.provider_id)
        .maybeSingle();

      if (config) setProviderConfig(config);

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
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending || !sessionId) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      // Insert user message
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          role: 'seeker',
          content: userMessage
        });

      if (insertError) throw insertError;

      // Call edge function for AI response
      setStreamingMessage('');
      const { error: replyError } = await supabase.functions.invoke('chat-reply', {
        body: { session_id: sessionId, user_message: userMessage }
      });

      if (replyError) throw replyError;

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
      setStreamingMessage('');
    }
  };

  const handleNewSession = async () => {
    if (!session?.engagement?.id) return;

    try {
      // Create new session
      const { data: newSession, error } = await supabase
        .from('sessions')
        .insert({
          engagement_id: session.engagement.id,
          status: 'active',
          initial_stage: session.initial_stage
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Started new session!');
      navigate(`/chat/${newSession.id}`);
    } catch (error: any) {
      console.error('Error creating new session:', error);
      toast.error('Failed to create new session');
    }
  };

  const handleClearMessages = async () => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', sessionId);

      if (error) throw error;

      setMessages([]);
      setShowClearDialog(false);
      toast.success('Messages cleared!');
    } catch (error: any) {
      console.error('Error clearing messages:', error);
      toast.error('Failed to clear messages');
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session ended');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <div className="h-6 w-px bg-slate-700" />
              <div>
                <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  {providerConfig?.title || 'Coaching Session'}
                </h1>
                {session?.initial_stage && (
                  <p className="text-sm text-slate-400">{session.initial_stage}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-300">
                {session?.status === 'active' ? 'Active' : 'Ended'}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-slate-300">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-700">
                  <DropdownMenuItem onClick={handleNewSession} className="text-slate-200 cursor-pointer">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start New Session
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowClearDialog(true)} className="text-slate-200 cursor-pointer">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} className="text-slate-200 cursor-pointer">
                    <History className="mr-2 h-4 w-4" />
                    View History
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem 
                    onClick={handleEndSession} 
                    className="text-red-400 cursor-pointer focus:text-red-300"
                  >
                    End Session
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col pt-20">
        <ScrollArea className="flex-1 px-4">
          <div className="max-w-3xl mx-auto py-6 space-y-4">
            {messages.length === 0 && !streamingMessage ? (
              <div className="text-center py-16">
                <Sparkles className="h-12 w-12 text-purple-400/50 mx-auto mb-4" />
                <p className="text-slate-400 text-lg mb-2">Start your conversation</p>
                <p className="text-slate-500 text-sm">
                  Share your thoughts, challenges, or questions
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'seeker' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        message.role === 'seeker'
                          ? 'bg-purple-500/20 text-white border border-purple-500/30'
                          : 'bg-slate-800/50 text-slate-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <p className="text-xs opacity-50 mt-2">
                        {new Date(message.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}

                {streamingMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                        <span className="text-xs text-slate-400">Coach is typing...</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{streamingMessage}</p>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-white/10 bg-slate-900/50 backdrop-blur-lg p-4">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={session?.status === 'ended' ? 'Session ended' : 'Type your message...'}
                disabled={sending || session?.status === 'ended'}
                className="flex-1 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 rounded-full px-6"
              />
              <Button 
                type="submit" 
                disabled={sending || !inputMessage.trim() || session?.status === 'ended'}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-full px-6"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Clear Messages Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Clear all messages?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete all messages in this conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearMessages}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Clear Messages
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}