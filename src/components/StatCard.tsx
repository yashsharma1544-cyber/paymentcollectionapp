import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

type Tone = "primary" | "destructive" | "success" | "warning" | "muted" | "accent";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: { value: string; positive?: boolean };
  to?: string;
  emphasis?: boolean;
  className?: string;
}

const toneMap: Record<Tone, { iconBg: string; iconColor: string; valueColor: string; ring: string }> = {
  primary:     { iconBg: "bg-primary/10",       iconColor: "text-primary",       valueColor: "text-foreground",  ring: "hover:ring-primary/30" },
  destructive: { iconBg: "bg-destructive/10",   iconColor: "text-destructive",   valueColor: "text-destructive", ring: "hover:ring-destructive/30" },
  success:     { iconBg: "bg-success/10",       iconColor: "text-success",       valueColor: "text-success",     ring: "hover:ring-success/30" },
  warning:     { iconBg: "bg-warning/10",       iconColor: "text-warning",       valueColor: "text-warning",     ring: "hover:ring-warning/30" },
  muted:       { iconBg: "bg-muted",            iconColor: "text-muted-foreground", valueColor: "text-foreground", ring: "hover:ring-border" },
  accent:      { iconBg: "bg-accent/10",        iconColor: "text-accent",        valueColor: "text-foreground",  ring: "hover:ring-accent/30" },
};

export function StatCard({ label, value, sub, icon: Icon, tone = "primary", trend, to, emphasis, className }: StatCardProps) {
  const c = toneMap[tone];
  const inner = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5 shadow-card transition-all",
        "hover:shadow-elevated hover:-translate-y-0.5 ring-1 ring-transparent",
        c.ring,
        emphasis && "bg-gradient-subtle",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={cn("inline-flex items-center justify-center h-9 w-9 rounded-xl", c.iconBg)}>
          <Icon className={cn("h-4.5 w-4.5", c.iconColor)} />
        </span>
        {trend && (
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
              trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl sm:text-2xl font-bold font-display tabular-nums leading-tight tracking-tight truncate", c.valueColor)}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>}
    </div>
  );

  if (to) return <Link to={to} className="block">{inner}</Link>;
  return inner;
}
