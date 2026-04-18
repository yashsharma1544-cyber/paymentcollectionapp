import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

type Tone = "primary" | "destructive" | "success" | "warning" | "muted" | "accent" | "brand";

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

const toneMap: Record<Tone, { bar: string; iconBg: string; iconColor: string; valueColor: string }> = {
  primary:     { bar: "bg-primary",     iconBg: "bg-primary/10",     iconColor: "text-primary",        valueColor: "text-foreground" },
  destructive: { bar: "bg-destructive", iconBg: "bg-destructive/10", iconColor: "text-destructive",    valueColor: "text-foreground" },
  success:     { bar: "bg-success",     iconBg: "bg-success/10",     iconColor: "text-success",        valueColor: "text-foreground" },
  warning:     { bar: "bg-warning",     iconBg: "bg-warning/10",     iconColor: "text-warning",        valueColor: "text-foreground" },
  muted:       { bar: "bg-muted-foreground/40", iconBg: "bg-muted", iconColor: "text-muted-foreground", valueColor: "text-foreground" },
  accent:      { bar: "bg-accent",      iconBg: "bg-accent/10",      iconColor: "text-accent",         valueColor: "text-foreground" },
  brand:       { bar: "bg-brand-navy",  iconBg: "bg-brand-navy/10",  iconColor: "text-brand-navy",     valueColor: "text-foreground" },
};

export function StatCard({ label, value, sub, icon: Icon, tone = "primary", trend, to, emphasis, className }: StatCardProps) {
  const c = toneMap[tone];
  const inner = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-3.5 sm:p-4 shadow-card transition-all",
        "hover:shadow-elevated hover:border-foreground/10",
        emphasis && "bg-gradient-subtle",
        className,
      )}
    >
      {/* Left accent bar */}
      <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", c.bar)} aria-hidden />

      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={cn("inline-flex items-center justify-center h-8 w-8 rounded-md", c.iconBg)}>
          <Icon className={cn("h-4 w-4", c.iconColor)} />
        </span>
        {trend && (
          <span
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded",
              trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-0.5 truncate">{label}</p>
      <p className={cn("kpi-number text-lg sm:text-2xl leading-tight truncate", c.valueColor)}>
        {value}
      </p>
      {sub && <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>}
    </div>
  );

  if (to) return <Link to={to} className="block">{inner}</Link>;
  return inner;
}
