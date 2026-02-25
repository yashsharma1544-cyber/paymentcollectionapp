import type { FollowUp } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, MessageSquare, Clock } from "lucide-react";

interface FollowUpListProps {
  followUps: FollowUp[];
  showCustomerName?: boolean;
}

export function FollowUpList({ followUps, showCustomerName = false }: FollowUpListProps) {
  if (followUps.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
        No follow-ups recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {followUps.map((f, i) => (
        <Card key={i} className="border shadow-sm">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {showCustomerName && (
                  <p className="text-sm font-semibold truncate">{f.customerName}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{f.followUpDate} {f.followUpTime}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant={f.type === "Payment" ? "default" : f.type === "Overdue" ? "destructive" : "secondary"} className="text-[10px]">
                  {f.type}
                </Badge>
                <Badge variant={f.status === "Pending" ? "outline" : "secondary"} className="text-[10px]">
                  {f.status}
                </Badge>
              </div>
            </div>
            {f.remarks && (
              <div className="flex items-start gap-1.5">
                <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-xs">{f.remarks}</p>
              </div>
            )}
            {f.nextFollowUpDate && (
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <CalendarClock className="h-3 w-3 shrink-0" />
                <span>Next: {f.nextFollowUpDate}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
