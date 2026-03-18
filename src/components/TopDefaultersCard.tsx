import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/lib/invoice";
import type { WhatsAppLogEntry, RecordedPayment } from "@/lib/api";
import { buildDefaulterList, getEscalationLabel, getEscalationColor } from "@/lib/escalation";
import { cn } from "@/lib/utils";

interface TopDefaultersCardProps {
  invoices: Invoice[];
  whatsappLog: WhatsAppLogEntry[];
  payments: RecordedPayment[];
}

export function TopDefaultersCard({ invoices, whatsappLog, payments }: TopDefaultersCardProps) {
  const top5 = useMemo(() => {
    const all = buildDefaulterList(invoices, whatsappLog, payments);
    return all.slice(0, 5);
  }, [invoices, whatsappLog, payments]);

  if (top5.length === 0) return null;

  return (
    <Card className="border-destructive/20 shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Top Chronic Defaulters
          </CardTitle>
          <Link to="/defaulters">
            <Button variant="ghost" size="sm" className="text-[10px] gap-1 h-6">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        {top5.map((d, idx) => (
          <Link
            key={d.customerName}
            to={`/customer/${encodeURIComponent(d.customerName)}`}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs font-black text-muted-foreground w-5 text-center">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{d.customerName}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />{d.beat}
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{d.reminderCount} reminders</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-destructive">₹{d.totalOutstanding.toLocaleString("en-IN")}</p>
              <Badge className={cn("text-[8px] h-4", getEscalationColor(d.escalationLevel))}>
                {getEscalationLabel(d.escalationLevel)}
              </Badge>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
