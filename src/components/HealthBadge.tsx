import type { HealthStatus } from "@/lib/health-score";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthBadgeProps {
  status: HealthStatus;
  score?: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const icons = {
  Good: ShieldCheck,
  Average: Shield,
  Risky: ShieldAlert,
};

const styles: Record<HealthStatus, string> = {
  Good: "bg-success/10 text-success border-success/20",
  Average: "bg-warning/10 text-warning border-warning/20",
  Risky: "bg-destructive/10 text-destructive border-destructive/20",
};

export function HealthBadge({ status, score, size = "sm", showLabel = true }: HealthBadgeProps) {
  const Icon = icons[status];
  const isSm = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold border",
        isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
        styles[status],
      )}
    >
      <Icon className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {showLabel && status}
      {score !== undefined && <span className="opacity-70">({score})</span>}
    </span>
  );
}
