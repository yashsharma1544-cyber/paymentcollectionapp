import type { HealthStatus } from "@/lib/health-score";
import { getHealthColor } from "@/lib/health-score";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

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

export function HealthBadge({ status, score, size = "sm", showLabel = true }: HealthBadgeProps) {
  const color = getHealthColor(status);
  const Icon = icons[status];
  const isSm = size === "sm";

  return (
    <span className={`inline-flex items-center gap-0.5 ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"} rounded-full font-semibold ${color.bg} ${color.text} ${color.border} border`}>
      <Icon className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {showLabel && status}
      {score !== undefined && <span className="opacity-70">({score})</span>}
    </span>
  );
}
