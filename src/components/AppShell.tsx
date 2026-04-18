import { useState, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  onRefresh?: () => void;
  isFetching?: boolean;
}

export function AppShell({ children, onRefresh, isFetching }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200",
          collapsed ? "sm:pl-[68px]" : "sm:pl-[244px]",
        )}
      >
        <TopBar onRefresh={onRefresh} isFetching={isFetching} />
        <main className="px-4 sm:px-6 py-5 sm:py-7">{children}</main>
      </div>
    </div>
  );
}
