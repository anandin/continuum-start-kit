import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Leaf, LogOut, Menu, X } from "lucide-react";
import { ProviderSidebar } from "@/components/Sidebar";
import { AlertsBell } from "@/components/AlertsBell";
import { SessionReminderBanner } from "@/components/SessionReminderBanner";
import { cn } from "@/lib/utils";

export function AppLayout({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isProvider = role === "provider";

  // Report the browser's detected IANA time zone once per session so the
  // server can render scheduled-session emails / .ics in the user's
  // local zone (no-op if tz hasn't actually changed since last sync).
  useEffect(() => {
    if (!user) return;
    let tz = "UTC";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch {}
    fetch("/api/user/timezone", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-warm-hero">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {isProvider && (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileOpen(o => !o)}
                aria-label="Toggle menu"
                data-testid="button-menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )}
            <button
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              onClick={() => navigate(isProvider ? "/provider/dashboard" : "/dashboard")}
              data-testid="button-home"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Leaf className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h1 className="text-lg font-semibold text-foreground">Haven</h1>
                {subtitle && <p className="text-xs text-muted-foreground hidden sm:block">{subtitle}</p>}
              </div>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isProvider && <AlertsBell />}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); }}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <SessionReminderBanner />

      <div className="flex">
        {/* Sidebar (provider only) */}
        {isProvider && (
          <>
            {/* Desktop */}
            <aside className="hidden lg:block w-64 shrink-0 border-r border-border/60 bg-card/40 min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
              <ProviderSidebar />
            </aside>
            {/* Mobile drawer */}
            <div className={cn(
              "lg:hidden fixed inset-0 z-20 transition-opacity",
              mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}>
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
              <aside className={cn(
                "absolute left-0 top-14 bottom-0 w-64 bg-card border-r border-border/60 transition-transform",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              )}>
                <div onClick={() => setMobileOpen(false)}>
                  <ProviderSidebar />
                </div>
              </aside>
            </div>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
            {title && (
              <div className="mb-6 animate-fade-in">
                <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">{title}</h2>
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
