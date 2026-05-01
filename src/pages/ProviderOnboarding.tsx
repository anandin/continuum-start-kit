import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Leaf, Sparkles, Send, RefreshCcw, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface GeneratedConfig {
  title: string;
  methodology: string;
  stages: Array<{ name: string; description?: string }>;
  labels: string[];
  summaryTemplate: string[];
  taggingRules: string[];
  trajectoryRules: string[];
  agent: {
    providerName?: string;
    providerTitle?: string;
    coreIdentity?: string;
    guidingPrinciples?: string;
    tone?: string;
    voice?: string;
    rules?: string;
    boundaries?: string;
  };
}

export default function ProviderOnboarding() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [generated, setGenerated] = useState<GeneratedConfig | null>(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (role && role !== "provider") {
      navigate("/dashboard");
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user || role !== "provider") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/provider-onboarding/status", { credentials: "include" });
        const chat = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (chat && Array.isArray(chat.messages) && chat.messages.length > 0) {
          setMessages(chat.messages as ChatMessage[]);
          if (chat.generatedConfig) {
            setGenerated(chat.generatedConfig as GeneratedConfig);
            setReadyToGenerate(true);
          }
          setBootstrapping(false);
        } else {
          // Bootstrap: send empty message to get the AI greeting
          const r = await apiRequest("POST", "/api/provider-onboarding/chat", { message: "" });
          const data = await r.json();
          if (cancelled) return;
          setMessages(data.chat?.messages || []);
          setReadyToGenerate(!!data.readyToGenerate);
          setBootstrapping(false);
        }
      } catch {
        setBootstrapping(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, role]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generated]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await apiRequest("POST", "/api/provider-onboarding/chat", { message: text });
      const data = await r.json();
      setMessages(data.chat?.messages || []);
      setReadyToGenerate(!!data.readyToGenerate);
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await apiRequest("POST", "/api/provider-onboarding/generate", {});
      const data = await r.json();
      setGenerated(data.generatedConfig);
    } catch (e: any) {
      toast({ title: "Couldn't generate config", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const apply = async () => {
    if (!generated) return;
    setApplying(true);
    try {
      await apiRequest("POST", "/api/provider-onboarding/apply", { config: generated });
      toast({ title: "Practice set up!", description: "Your Haven space is ready." });
      navigate("/provider/dashboard");
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const restart = async () => {
    setMessages([]);
    setGenerated(null);
    setReadyToGenerate(false);
    setBootstrapping(true);
    try {
      const r = await apiRequest("POST", "/api/provider-onboarding/chat", { reset: true, message: "" });
      const data = await r.json();
      setMessages(data.chat?.messages || []);
      setReadyToGenerate(!!data.readyToGenerate);
    } finally { setBootstrapping(false); }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm-hero">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Leaf className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Haven</h1>
              <p className="text-xs text-muted-foreground">Setting up your practice</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={restart} data-testid="button-restart">
            <RefreshCcw className="mr-2 h-4 w-4" /> Start over
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
          {/* Chat column */}
          <Card className="shadow-warm flex flex-col h-[calc(100vh-12rem)] animate-fade-in">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                Let's design your practice together
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                A short conversation. I'll learn how you work, then prepare your Haven space.
              </p>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <div ref={scrollRef} className="h-full overflow-y-auto px-6 py-4 space-y-4">
                {bootstrapping && messages.length === 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Warming up...
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${m.role}-${i}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border/60 text-foreground rounded-bl-sm"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-card border border-border/60 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <div className="border-t border-border/60 p-4 space-y-2">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type your reply..."
                  className="resize-none min-h-[60px]"
                  disabled={sending || bootstrapping}
                  data-testid="input-message"
                />
                <Button onClick={send} disabled={sending || !input.trim() || bootstrapping} data-testid="button-send">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {readyToGenerate && !generated && (
                <Button onClick={generate} disabled={generating} className="w-full" variant="default" data-testid="button-generate">
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate my practice setup
                </Button>
              )}
            </div>
          </Card>

          {/* Preview column */}
          <div className="space-y-4 animate-fade-in">
            {!generated && (
              <Card className="shadow-warm">
                <CardHeader>
                  <CardTitle className="text-base">What we're building</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>As we talk, I'll piece together:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> Your program title and approach</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> The journey stages your clients move through</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> Your voice, tone, and boundaries</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> An AI assistant that sounds like you</li>
                  </ul>
                </CardContent>
              </Card>
            )}
            {generated && (
              <ConfigPreview config={generated} onChange={setGenerated} onApply={apply} applying={applying} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ConfigPreview({ config, onChange, onApply, applying }: {
  config: GeneratedConfig;
  onChange: (c: GeneratedConfig) => void;
  onApply: () => void;
  applying: boolean;
}) {
  return (
    <Card className="shadow-warm border-primary/30 animate-fade-in" data-testid="config-preview">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Here's what I understood
        </CardTitle>
        <p className="text-xs text-muted-foreground">Tweak anything, then save.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm max-h-[calc(100vh-20rem)] overflow-y-auto">
        <Field label="Practice title" value={config.title} onChange={v => onChange({ ...config, title: v })} testid="field-title" />
        <Field label="Methodology" value={config.methodology} onChange={v => onChange({ ...config, methodology: v })} multiline testid="field-methodology" />
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Journey stages</p>
          <div className="space-y-2">
            {config.stages.map((s, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-card/50 px-3 py-2">
                <p className="font-medium text-foreground">{s.name}</p>
                {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
              </div>
            ))}
          </div>
        </div>
        {config.agent && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Your AI assistant</p>
            {config.agent.providerName && <p><span className="text-muted-foreground">Name:</span> {config.agent.providerName}</p>}
            {config.agent.tone && <p><span className="text-muted-foreground">Tone:</span> {config.agent.tone}</p>}
            {config.agent.voice && <p><span className="text-muted-foreground">Voice:</span> {config.agent.voice}</p>}
            {config.agent.coreIdentity && <p className="text-xs text-muted-foreground">"{config.agent.coreIdentity}"</p>}
          </div>
        )}
        <Button onClick={onApply} disabled={applying} className="w-full" data-testid="button-apply-config">
          {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Looks good — set up my practice
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, multiline, testid }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; testid?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {multiline ? (
        <Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[60px] text-sm" data-testid={testid} />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          data-testid={testid}
        />
      )}
    </div>
  );
}
