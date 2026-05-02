import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useNavigate } from "react-router-dom";

interface Alert {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  engagementId: string | null;
}

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/alerts/unread-count"],
    refetchInterval: 60_000,
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    enabled: open,
  });

  const count = countData?.count ?? 0;

  const markRead = async (id: string) => {
    await apiRequest("PUT", `/api/alerts/${id}/read`);
    qc.invalidateQueries({ queryKey: ["/api/alerts"] });
    qc.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
  };

  const markAll = async () => {
    await apiRequest("PUT", "/api/alerts/read-all");
    qc.invalidateQueries({ queryKey: ["/api/alerts"] });
    qc.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
  };

  const handleClick = (a: Alert) => {
    if (!a.isRead) markRead(a.id);
    if (a.engagementId) {
      navigate(`/provider/engagement/${a.engagementId}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" data-testid="button-alerts">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} className="text-xs h-7" data-testid="button-mark-all-read">
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              You're all caught up.
            </div>
          ) : (
            alerts.map(a => (
              <button
                key={a.id}
                onClick={() => handleClick(a)}
                className={`w-full text-left border-b border-border/40 px-4 py-3 text-sm hover:bg-muted/40 transition-colors ${!a.isRead ? "bg-primary/5" : ""}`}
                data-testid={`alert-${a.id}`}
              >
                <p className="text-foreground">{a.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
