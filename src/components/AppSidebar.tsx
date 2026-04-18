import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CalendarClock, Star, Users, History, AlertTriangle,
  ClipboardList, BarChart3, Brain, Route, IndianRupee, ChevronLeft, ChevronRight, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";

const sections: { label: string; items: { to: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/due-today", label: "Due Today", icon: CalendarClock },
      { to: "/focus", label: "Focus Customers", icon: Star },
    ],
  },
  {
    label: "Customers",
    items: [
      { to: "/crm", label: "CRM", icon: Users },
      { to: "/defaulters", label: "Defaulters", icon: AlertTriangle },
      { to: "/payments", label: "Payments Log", icon: History },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/predictions", label: "AI Predictions", icon: Brain },
      { to: "/route-planner", label: "Route Planner", icon: Route },
      { to: "/daily-report", label: "Daily Report", icon: ClipboardList },
      { to: "/monthly-report", label: "Monthly Report", icon: BarChart3 },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { currentUser, clearUser } = useUser();
  const { pathname } = useLocation();

  return (
    <aside
      className={cn(
        "hidden sm:flex fixed inset-y-0 left-0 z-40 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[244px]",
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center gap-2.5 px-4 h-16 border-b border-sidebar-border shrink-0", collapsed && "justify-center px-0")}>
        <div className="h-9 w-9 rounded-lg bg-gradient-primary shadow-glow flex items-center justify-center shrink-0">
          <IndianRupee className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-extrabold font-display text-white tracking-tight leading-tight">FMCG COLLECT</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/60 leading-tight">Receivables Suite</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="px-5 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map((it) => {
                const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
                return (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_2px_8px_-2px_hsl(var(--sidebar-primary)/0.5)]"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center px-0",
                      )}
                      title={collapsed ? it.label : undefined}
                    >
                      <it.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User / collapse */}
      <div className="border-t border-sidebar-border p-3 shrink-0 space-y-2">
        <button
          onClick={clearUser}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-2.5 py-2 hover:bg-sidebar-accent transition-colors",
            collapsed && "justify-center px-0",
          )}
          title="Switch user"
        >
          <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground shrink-0">
            {currentUser?.split(" ").map(s => s[0]).join("").slice(0, 2)}
          </div>
          {!collapsed && (
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold text-white truncate">{currentUser}</p>
              <p className="text-[10px] text-sidebar-foreground/60">Switch user</p>
            </div>
          )}
        </button>
        <button
          onClick={onToggle}
          className={cn(
            "w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
