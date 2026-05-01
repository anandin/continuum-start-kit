import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, Users, BookOpen, ClipboardList, BarChart3, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/provider/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/provider/schedule", label: "Schedule", icon: Calendar },
  { to: "/provider/resources", label: "Resources", icon: BookOpen },
  { to: "/provider/intake-forms", label: "Intake Forms", icon: ClipboardList },
  { to: "/provider/analytics", label: "Insights", icon: BarChart3 },
  { to: "/provider/setup", label: "Settings", icon: Settings },
];

export function ProviderSidebar() {
  const loc = useLocation();
  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main navigation">
      <NavLink
        to="/provider/onboarding"
        className={({ isActive }) => cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors mb-2",
          "bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-primary hover:from-primary/15 hover:to-accent/15"
        )}
        data-testid="nav-onboarding"
      >
        <Sparkles className="h-4 w-4" />
        Re-run setup chat
      </NavLink>
      {navItems.map(item => {
        const Icon = item.icon;
        const active = loc.pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
