import { Link, useLocation } from "react-router-dom";
import { Home, CalendarClock, History, Star, Users, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/due-today", label: "Due", icon: CalendarClock },
  { to: "/focus", label: "Focus", icon: Star },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/payments", label: "Log", icon: History },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { currentUser, clearUser } = useUser();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden">
      <div className="mx-2 mb-2 rounded-2xl border bg-card/85 backdrop-blur-xl shadow-elevated supports-[backdrop-filter]:bg-card/70">
        <div className="flex items-center justify-around h-14 px-1">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-xl transition-all",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive && (
                  <span className="absolute inset-x-2 inset-y-1 rounded-lg bg-primary/10 -z-0" aria-hidden />
                )}
                <item.icon className={cn("h-5 w-5 relative", isActive && "stroke-[2.4]")} />
                <span className={cn("text-[9.5px] relative", isActive ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={clearUser}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <UserCircle className="h-5 w-5" />
            <span className="text-[9.5px] font-medium truncate max-w-[52px]">
              {currentUser?.split(" ")[0]}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
