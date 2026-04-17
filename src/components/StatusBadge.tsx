import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isPaid = status.toLowerCase() === "paid";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-0.5 border",
        isPaid
          ? "bg-success/10 text-success border-success/20"
          : "bg-warning/10 text-warning border-warning/20",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isPaid ? "bg-success" : "bg-warning",
        )}
      />
      {status}
    </span>
  );
}
