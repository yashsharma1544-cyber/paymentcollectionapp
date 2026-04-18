import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarClock, History, Star, Users, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";

const navItems = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/due-today", label: "Due", icon: CalendarClock },
  { to: "/focus", label: "Focus", icon: Star },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/payments", label: "Log", icon: History },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { currentUser, clearUser } = useUser();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-2 mb-2 rounded-xl border bg-card/95 backdrop-blur-xl shadow-elevated">
        <div className="flex items-stretch justify-around h-14 px-1">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 rounded-lg transition-all px-0.5",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive && (
                  <span className="absolute inset-x-1.5 inset-y-1 rounded-md bg-primary/10 -z-0" aria-hidden />
                )}
                <item.icon className={cn("h-[18px] w-[18px] relative", isActive && "stroke-[2.4]")} />
                <span className={cn("text-[9px] leading-none relative", isActive ? "font-bold" : "font-semibold")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={clearUser}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 rounded-lg text-muted-foreground hover:text-foreground transition-colors px-0.5"
          >
            <UserCircle className="h-[18px] w-[18px]" />
            <span className="text-[9px] leading-none font-semibold truncate max-w-full">
              {currentUser?.split(" ")[0]}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
