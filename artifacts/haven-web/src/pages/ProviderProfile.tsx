import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Leaf, Sparkles, ChevronRight } from "lucide-react";

interface PublicProvider {
  providerId: string;
  title: string;
  methodology: string;
  stages: Array<{ name: string; description?: string }>;
  labels: string[];
  providerName: string;
  providerTitle: string;
  avatarUrl: string;
}

export default function ProviderProfile() {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PublicProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!providerId) return;
    (async () => {
      try {
        const res = await fetch(`/api/public/provider/${providerId}`);
        if (res.status === 404) setNotFound(true);
        else if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [providerId]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-warm-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  if (notFound || !data)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-warm-hero p-6">
        <Card className="shadow-warm max-w-md">
          <CardContent className="py-12 text-center">
            <Leaf className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-foreground font-medium">Coach not found</p>
            <p className="text-sm text-muted-foreground mt-2">
              This profile may have moved.
            </p>
            <Button className="mt-6" onClick={() => navigate("/")}>
              Back to Haven
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-warm-hero">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:opacity-80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Leaf className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Haven</h1>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10 animate-fade-in">
          <Avatar className="h-24 w-24 mx-auto mb-4 ring-4 ring-card shadow-warm">
            {data.avatarUrl && (
              <AvatarImage src={data.avatarUrl} alt={data.providerName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {(data.providerName || data.title || "C").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-3xl font-semibold text-foreground">
            {data.providerName || data.title}
          </h2>
          {data.providerTitle && (
            <p className="text-muted-foreground mt-1">{data.providerTitle}</p>
          )}
        </div>

        <Card className="shadow-warm mb-6 animate-fade-in">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Approach
            </div>
            <h3 className="text-xl font-medium text-foreground mb-3">
              {data.title}
            </h3>
            <p className="text-foreground/80 leading-relaxed">
              {data.methodology}
            </p>
            {data.labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {data.labels.map((l) => (
                  <Badge key={l} variant="secondary">
                    {l}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {data.stages.length > 0 && (
          <Card className="shadow-warm mb-6 animate-fade-in">
            <CardContent className="py-6">
              <h3 className="text-base font-semibold mb-4">The journey</h3>
              <div className="space-y-3">
                {data.stages.map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{s.name}</p>
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center pt-4 animate-fade-in">
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            data-testid="button-connect"
            className="shadow-warm"
          >
            Connect with this coach <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
