import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FollowUp } from "@/lib/api";
import { updateFollowUpStatus } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, MessageSquare, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface FollowUpListProps {
  followUps: FollowUp[];
  showCustomerName?: boolean;
}

export function FollowUpList({ followUps, showCustomerName = false }: FollowUpListProps) {
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleMarkDone = async (f: FollowUp) => {
    const key = `${f.customerName}-${f.createdAt}`;
    setMarkingDone(key);
    try {
      await updateFollowUpStatus(f.customerName, f.createdAt, "Done");
      toast.success("Follow-up marked as Done");
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    } catch (e) {
      toast.error("Failed to update follow-up");
    } finally {
      setMarkingDone(null);
    }
  };

  if (followUps.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
        No follow-ups recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {followUps.map((f, i) => {
        const key = `${f.customerName}-${f.createdAt}`;
        const isMarking = markingDone === key;
        return (
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
              <div className="flex items-center justify-between gap-2">
                {f.nextFollowUpDate ? (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    <span>Next: {f.nextFollowUpDate}</span>
                  </div>
                ) : <div />}
                {f.status === "Pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-green-600 border-green-600 hover:bg-green-50"
                    disabled={isMarking}
                    onClick={() => handleMarkDone(f)}
                  >
                    <CheckCircle className="h-3 w-3" />
                    {isMarking ? "Saving..." : "Mark Done"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}