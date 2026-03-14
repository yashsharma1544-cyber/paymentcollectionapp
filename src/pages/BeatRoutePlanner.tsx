import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments } from "@/lib/api";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, IndianRupee, MapPin, Navigation, Phone, RefreshCw, Route } from "lucide-react";
import { Link } from "react-router-dom";
import { getOverdueDays, formatOverdue } from "@/lib/date-utils";
import { HealthBadge } from "@/components/HealthBadge";
import { calculateHealthScore } from "@/lib/health-score";

const BeatRoutePlanner = () => {
  const [selectedBeat, setSelectedBeat] = useState<string>("");

  const { data: invoices = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["invoices"], queryFn: fetchInvoices,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments,
  });

  const beats = useMemo(() => {
    const set = new Set(invoices.map(i => i.beat));
    return Array.from(set).sort();
  }, [invoices]);

  // Auto-select first beat
  useMemo(() => {
    if (!selectedBeat && beats.length > 0) setSelectedBeat(beats[0]);
  }, [beats, selectedBeat]);

  // Build route: customers sorted by most overdue first
  const route = useMemo(() => {
    if (!selectedBeat) return [];
    const beatInvs = invoices.filter(i => i.beat === selectedBeat && i.outstandingAmount > 0);
    const map = new Map<string, { outstanding: number; maxOverdue: number; phone: string; billCount: number }>();
    for (const inv of beatInvs) {
      if (!map.has(inv.customerName)) {
        map.set(inv.customerName, { outstanding: 0, maxOverdue: 0, phone: inv.mobileNo, billCount: 0 });
      }
      const e = map.get(inv.customerName)!;
      e.outstanding += inv.outstandingAmount;
      e.maxOverdue = Math.max(e.maxOverdue, getOverdueDays(inv.billDate));
      e.billCount++;
      if (!e.phone && inv.mobileNo) e.phone = inv.mobileNo;
    }
    return Array.from(map.entries())
      .map(([name, d]) => {
        const health = calculateHealthScore(name, invoices, payments);
        return { name, ...d, health };
      })
      .sort((a, b) => b.maxOverdue - a.maxOverdue);
  }, [invoices, payments, selectedBeat]);

  const totalRouteOutstanding = route.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/"><Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Route className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">Beat Route Planner</h1>
              <p className="text-[11px] text-muted-foreground">Prioritized by most overdue first</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {isLoading ? <Skeleton className="h-96 rounded-xl" /> : (
          <>
            <div className="flex items-center gap-3">
              <Select value={selectedBeat} onValueChange={setSelectedBeat}>
                <SelectTrigger className="h-9 w-[200px] text-xs">
                  <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                  <SelectValue placeholder="Select Beat" />
                </SelectTrigger>
                <SelectContent>{beats.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {route.length} stop{route.length !== 1 ? "s" : ""} · ₹{totalRouteOutstanding.toLocaleString("en-IN")} outstanding
              </span>
            </div>

            {route.length === 0 ? (
              <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground text-sm">
                No outstanding customers in this beat
              </div>
            ) : (
              <div className="space-y-2">
                {route.map((stop, idx) => (
                  <Card key={stop.name} className="border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        {/* Stop number */}
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? "bg-destructive text-destructive-foreground" : "bg-primary/10 text-primary"}`}>
                            {idx + 1}
                          </div>
                          {idx < route.length - 1 && (
                            <div className="w-0.5 h-6 bg-border" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Link to={`/customer/${encodeURIComponent(stop.name)}`} className="text-sm font-semibold hover:underline text-primary truncate">
                              {stop.name}
                            </Link>
                            <span className="text-sm font-black text-destructive shrink-0">
                              ₹{stop.outstanding.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {stop.phone && (
                              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                <Phone className="h-3 w-3" />{stop.phone}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                              {formatOverdue(stop.maxOverdue)} overdue
                            </span>
                            <span className="text-[10px] text-muted-foreground">{stop.billCount} bill{stop.billCount !== 1 ? "s" : ""}</span>
                            <HealthBadge status={stop.health.status} size="sm" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default BeatRoutePlanner;
