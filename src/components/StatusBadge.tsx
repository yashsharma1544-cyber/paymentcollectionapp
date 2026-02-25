import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isPaid = status.toLowerCase() === "paid";
  return (
    <Badge
      variant={isPaid ? "default" : "outline"}
      className={
        isPaid
          ? "bg-success text-success-foreground border-success"
          : "border-warning text-warning bg-warning/10"
      }
    >
      {status}
    </Badge>
  );
}
