import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, MapPin, Bell } from "lucide-react";
import type { Invoice } from "@/lib/invoice";
import type { WhatsAppLogEntry, RecordedPayment } from "@/lib/api";
import { buildDefaulterList, getEscalationLabel, getEscalationColor } from "@/lib/escalation";
import { cn } from "@/lib/utils";

interface TopDefaultersCardProps {
  invoices: Invoice[];
  whatsappLog: WhatsAppLogEntry[];
  payments: RecordedPayment[];
}

const initials = (name: string) =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function TopDefaultersCard({ invoices, whatsappLog, payments }: TopDefaultersCardProps) {
  const top5 = useMemo(() => {
    const all = buildDefaulterList(invoices, whatsappLog, payments);
    return all.slice(0, 5);
  }, [invoices, whatsappLog, payments]);

  if (top5.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </span>
          <div>
            <h3 className="text-sm font-bold font-display leading-tight">Top Chronic Defaulters</h3>
            <p className="text-[11px] text-muted-foreground">Customers needing immediate attention</p>
          </div>
        </div>
        <Link to="/defaulters" className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y">
        {top5.map((d, idx) => (
          <Link
            key={d.customerName}
            to={`/customer/${encodeURIComponent(d.customerName)}`}
            className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/50 transition-colors group"
          >
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 text-destructive flex items-center justify-center text-xs font-bold">
                {initials(d.customerName)}
              </div>
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-card border text-[9px] font-bold flex items-center justify-center text-muted-foreground">
                {idx + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{d.customerName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />{d.beat}
                </span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                  <Bell className="h-2.5 w-2.5" />{d.reminderCount}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-destructive tabular-nums">₹{d.totalOutstanding.toLocaleString("en-IN")}</p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <Badge className={cn("text-[9px] h-4 px-1.5", getEscalationColor(d.escalationLevel))}>
                  {getEscalationLabel(d.escalationLevel)}
                </Badge>
                {d.lastEscalationSent && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-warning/40 text-warning">
                    📨
                  </Badge>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
