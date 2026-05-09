import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, MessageSquareQuote, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface JournalEntry {
  id: string;
  body: string;
  promptId: string | null;
  sharedWithCoach: boolean;
  sharedAt: string | null;
  createdAt: string;
}

interface JournalPrompt {
  id: string;
  text: string;
  category: string | null;
}

interface JournalPanelProps {
  engagementId: string;
}

export function JournalPanel({ engagementId }: JournalPanelProps) {
  const entriesQ = useQuery<JournalEntry[]>({
    queryKey: [`/api/engagements/${engagementId}/journal`],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${engagementId}/journal`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load journal entries");
      return res.json();
    },
  });

  const promptsQ = useQuery<JournalPrompt[]>({
    queryKey: ["/api/journal/prompts"],
    queryFn: async () => {
      const res = await fetch("/api/journal/prompts", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load prompts");
      return res.json();
    },
  });

  const promptById = new Map<string, JournalPrompt>();
  for (const p of promptsQ.data ?? []) promptById.set(p.id, p);

  if (entriesQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const entries = entriesQ.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-4 w-4" />
              Shared journal
            </CardTitle>
            <CardDescription>
              Entries this client chose to share. Private reflections stay
              private.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/provider/journal-prompts">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Manage prompts
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
              <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-60" />
              No shared entries yet. Encourage your client to reflect — they
              control whether each entry is shared.
            </div>
          ) : (
            <ul className="space-y-3" data-testid="journal-entries">
              {entries.map((e) => {
                const prompt = e.promptId ? promptById.get(e.promptId) : null;
                const sharedDate = e.sharedAt ?? e.createdAt;
                return (
                  <li
                    key={e.id}
                    className="border rounded-lg p-4 bg-card"
                    data-testid={`journal-entry-${e.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(sharedDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        Shared
                      </Badge>
                    </div>
                    {prompt ? (
                      <div className="flex items-start gap-2 mb-2 text-sm text-primary">
                        <MessageSquareQuote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{prompt.text}</span>
                      </div>
                    ) : null}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {e.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
