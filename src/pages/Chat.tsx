import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
    setStreamingMessage('');

    try {
      // Call edge function for streaming AI response
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ sessionId, message: userMessage }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.content;
                if (content) {
                  setStreamingMessage(prev => prev + content);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Reload messages first, then clear streaming
      await loadMessages();
      setStreamingMessage('');

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
      setStreamingMessage('');
    } finally {
      setSending(false);
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
      // Call session-finish edge function to generate summary
      const { data, error } = await supabase.functions.invoke('session-finish', {
        body: { sessionId }
      });

      if (error) throw error;

      toast.success('Session ended - generating summary...');
      
      // Navigate to summary page if one was created
      if (data?.summary?.id) {
        navigate(`/session-summary/${sessionId}`);
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-sky-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-lg border-b border-sky-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-slate-700 hover:text-indigo-900 hover:bg-sky-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <div className="h-6 w-px bg-sky-300" />
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-indigo-200">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${providerConfig?.title}`} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-900">
                    {providerConfig?.title?.charAt(0) || 'C'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-base font-semibold text-indigo-900 flex items-center gap-2">
                    {providerConfig?.title || 'Coaching Session'}
                  </h1>
                  {session?.initial_stage && (
                    <p className="text-xs text-slate-600">{session.initial_stage} • 65% Progress</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-sky-100 border-sky-300 text-indigo-900">
                {session?.status === 'active' ? 'Active' : 'Ended'}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-slate-700 hover:bg-sky-100">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-sky-200">
                  <DropdownMenuItem onClick={handleNewSession} className="text-slate-700 cursor-pointer hover:bg-sky-50">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start New Session
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowClearDialog(true)} className="text-slate-700 cursor-pointer hover:bg-sky-50">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} className="text-slate-700 cursor-pointer hover:bg-sky-50">
                    <History className="mr-2 h-4 w-4" />
                    View History
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-sky-200" />
                  <DropdownMenuItem 
                    onClick={handleEndSession} 
                    className="text-red-600 cursor-pointer focus:text-red-700 hover:bg-red-50"
                  >
                    End Session
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex pt-16 max-w-7xl mx-auto w-full">
        {/* Messages Panel */}
        <div className="flex-1 flex flex-col border-r border-sky-200">
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-3xl mx-auto py-6 space-y-4">
              {messages.length === 0 && !streamingMessage ? (
                <div className="text-center py-16">
                  <Sparkles className="h-12 w-12 text-indigo-400 mx-auto mb-4" />
                  <p className="text-slate-700 text-lg mb-2">Start your conversation</p>
                  <p className="text-slate-500 text-sm">
                    Share your thoughts, challenges, or questions
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'seeker' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {message.role !== 'seeker' && (
                        <Avatar className="h-8 w-8 border-2 border-indigo-200 flex-shrink-0">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=coach`} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-900 text-xs">C</AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          message.role === 'seeker'
                            ? 'bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-md'
                            : 'bg-white text-slate-800 border border-sky-200 shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
                        <p className={`text-xs mt-2 ${message.role === 'seeker' ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {new Date(message.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {streamingMessage && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 border-2 border-indigo-200 flex-shrink-0">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=coach`} />
                        <AvatarFallback className="bg-indigo-100 text-indigo-900 text-xs">C</AvatarFallback>
                      </Avatar>
                      <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white border border-sky-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                          <span className="text-xs text-slate-500">Coach is typing...</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-sm text-slate-800">{streamingMessage}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-sky-200 bg-white/80 backdrop-blur-lg p-4">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={session?.status === 'ended' ? 'Session ended' : 'Type your message...'}
                  disabled={sending || session?.status === 'ended'}
                  className="flex-1 bg-white border-sky-300 text-slate-900 placeholder:text-slate-400 rounded-full px-6 focus:border-indigo-500 focus:ring-indigo-500"
                />
                <Button 
                  type="submit" 
                  disabled={sending || !inputMessage.trim() || session?.status === 'ended'}
                  className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 rounded-full px-6 shadow-md"
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

        {/* Right Panel - Nudges & Insights */}
        <div className="w-80 bg-white/80 backdrop-blur-lg p-6 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Today's Nudge
            </h3>
            <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border border-sky-200 rounded-xl p-4">
              <p className="text-sm text-slate-700">
                "Take a moment to reflect on one challenge you've overcome this week. What did you learn?"
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-indigo-900 mb-3">Reflection Tracker</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Today's Progress</span>
                <span className="text-indigo-600 font-semibold">65%</span>
              </div>
              <Progress value={65} className="h-2" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-indigo-900 mb-3">Recent Insights</h3>
            <div className="space-y-2">
              <div className="bg-white border border-sky-200 rounded-lg p-3">
                <p className="text-xs text-slate-700">Strong emotional awareness in recent sessions</p>
              </div>
              <div className="bg-white border border-sky-200 rounded-lg p-3">
                <p className="text-xs text-slate-700">Consistent engagement with reflection exercises</p>
              </div>
              <div className="bg-white border border-sky-200 rounded-lg p-3">
                <p className="text-xs text-slate-700">Building leadership confidence steadily</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <Button 
              onClick={() => navigate(`/session-summary/${sessionId}`)}
              variant="outline"
              className="w-full border-indigo-300 text-indigo-900 hover:bg-indigo-50"
              size="sm"
            >
              View Summary
            </Button>
            <Button 
              onClick={() => toast.success('Progress saved!')}
              className="w-full bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700"
              size="sm"
            >
              Save Progress
            </Button>
          </div>

          <div className="pt-6 border-t border-sky-200">
            <p className="text-xs text-center text-slate-600 italic">
              "Every step forward is progress worth celebrating"
            </p>
          </div>
        </div>
      </div>

      {/* Clear Messages Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="bg-white border-sky-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-indigo-900">Clear all messages?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This will permanently delete all messages in this conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white text-slate-700 border-sky-300 hover:bg-sky-50">
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