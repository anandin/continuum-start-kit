import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare, Send, Activity, CheckCircle, AlertTriangle, StopCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'seeker' | 'agent' | 'provider';
  content: string;
  created_at: string;
}

interface ProgressIndicator {
  id: string;
  type: 'drift' | 'leap' | 'stall' | 'steady';
  detail: any;
  created_at: string;
}

export default function Chat() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [providerConfig, setProviderConfig] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [indicators, setIndicators] = useState<ProgressIndicator[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && sessionId) {
      loadSession();
    }
  }, [user, sessionId]);

  useEffect(() => {
    if (sessionId) {
      console.log('🔄 Session ID changed, loading data...');
      loadMessages();
      loadIndicators();
      setupRealtimeSubscription();
    }
  }, [sessionId]);

  useEffect(() => {
    console.log('💬 Messages state updated:', messages.length, 'messages');
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

      // Load provider config
      const { data: config, error: configError } = await supabase
        .from('provider_configs')
        .select('*')
        .eq('provider_id', data.engagement.provider_id)
        .maybeSingle();

      if (configError) console.error('Config error:', configError);
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

    console.log('📨 Loading messages for session:', sessionId);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      console.log('📬 Messages result:', { data, error, count: data?.length });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const loadIndicators = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('progress_indicators')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setIndicators((data as ProgressIndicator[]) || []);
    } catch (error: any) {
      console.error('Error loading indicators:', error);
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'progress_indicators',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          setIndicators(prev => [payload.new as ProgressIndicator, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || sending) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    setStreamingMessage('');

    try {
      // Call edge function with streaming
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          sessionId,
          message: messageText
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

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
              if (parsed.content) {
                setStreamingMessage(prev => prev + parsed.content);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Clear streaming message after complete
      setStreamingMessage('');
      
    } catch (error: any) {
      console.error('Send message error:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getIndicatorIcon = (type: string) => {
    switch (type) {
      case 'leap': return <Activity className="h-4 w-4 text-green-500" />;
      case 'drift': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'stall': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'steady': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getIndicatorColor = (type: string) => {
    switch (type) {
      case 'leap': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'drift': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'stall': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'steady': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    const confirmed = window.confirm(
      'Are you sure you want to end this session? A summary will be generated and you can start a new session afterwards.'
    );

    if (!confirmed) return;

    setEnding(true);
    try {
      const { data, error } = await supabase.functions.invoke('session-finish', {
        body: { sessionId }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Session ended successfully!');
        navigate(`/session/${sessionId}/summary`);
      } else {
        throw new Error('Failed to end session');
      }
    } catch (error: any) {
      console.error('End session error:', error);
      toast.error(error.message || 'Failed to end session');
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-white/10 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="w-full justify-start mb-4 text-white hover:bg-white/10">
            ← Back to Dashboard
          </Button>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Session Info</h2>
            <div className="flex items-center gap-2">
              <Badge variant={session?.status === 'active' ? 'default' : 'secondary'} className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                {session?.status || 'Unknown'}
              </Badge>
              <span className="text-xs text-slate-400">
                {session?.started_at && new Date(session.started_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-semibold mb-3 text-white">Growth Stages</h3>
          <div className="space-y-2">
            {providerConfig?.stages && (providerConfig.stages as any[]).map((stage, index) => {
              const isCurrent = stage.name === session?.initial_stage;
              return (
                <div
                  key={index}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    isCurrent 
                      ? 'bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30' 
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-medium">{stage.name}</div>
                  <div className="text-xs opacity-80 mt-0.5">{stage.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="flex-1 overflow-hidden">
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-white">Recent Progress</h3>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {indicators.length === 0 ? (
                  <p className="text-xs text-slate-400">No indicators yet</p>
                ) : (
                  indicators.map((indicator) => (
                    <div key={indicator.id} className="p-3 rounded-lg border border-white/10 bg-slate-800/50">
                      <div className="flex items-center gap-2 mb-1">
                        {getIndicatorIcon(indicator.type)}
                        <Badge variant="outline" className={getIndicatorColor(indicator.type)}>
                          {indicator.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(indicator.created_at).toLocaleString()}
                      </p>
                      {indicator.detail && (
                        <p className="text-xs mt-1 text-slate-300">{JSON.stringify(indicator.detail)}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Right: Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-slate-900/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                  Coaching Session
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                {session?.initial_stage && `Current Stage: ${session.initial_stage}`}
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={handleEndSession}
              disabled={ending || session?.status === 'ended'}
            >
              {ending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ending...
                </>
              ) : (
                <>
                  <StopCircle className="mr-2 h-4 w-4" />
                  End Session
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'seeker' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'seeker'
                      ? 'bg-purple-500/20 text-white border border-purple-500/30'
                      : 'bg-slate-800/50 text-slate-200 border border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs bg-slate-900/50 border-white/20">
                      {message.role === 'seeker' ? 'You' : 'Coach'}
                    </Badge>
                    <span className="text-xs opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-4 bg-slate-800/50 text-slate-200 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs bg-slate-900/50 border-white/20">Coach</Badge>
                    <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                  </div>
                  <p className="whitespace-pre-wrap">{streamingMessage}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="border-t border-white/10 bg-slate-900/50 backdrop-blur p-4">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={session?.status === 'ended' ? 'Session ended' : 'Type your message...'}
              disabled={sending || session?.status === 'ended'}
              className="flex-1 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500"
            />
            <Button type="submit" disabled={sending || !inputMessage.trim() || session?.status === 'ended'} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
