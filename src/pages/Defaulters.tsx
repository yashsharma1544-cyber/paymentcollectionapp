import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchWhatsAppLog, fetchRecordedPayments } from "@/lib/api";
import { buildDefaulterList, getEscalationLabel, getEscalationColor, type DefaulterInfo, type EscalationLevel } from "@/lib/escalation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Phone, MapPin, MessageSquare, IndianRupee, Eye, Users, Route, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function DefaulterCard({ d }: { d: DefaulterInfo }) {
  const escalationColor = getEscalationColor(d.escalationLevel);
  const escalationLabel = getEscalationLabel(d.escalationLevel);

  return (
    <Card className={cn(
      "border-l-4 transition-all",
      d.escalationLevel === "supply_stop" ? "border-l-destructive" :
      d.escalationLevel === "final" ? "border-l-destructive/70" :
      d.escalationLevel === "visit" ? "border-l-warning" :
      d.escalationLevel === "firm" ? "border-l-orange-500" :
      "border-l-muted-foreground/30"
    )}>
      <CardContent className="p-3 sm:p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link to={`/customer/${encodeURIComponent(d.customerName)}`} className="font-bold text-sm hover:underline truncate block">
              {d.customerName}
            </Link>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />{d.beat}
              </span>
              <span className="text-xs text-muted-foreground">{d.invoiceCount} bills</span>
            </div>
          </div>
          <Badge className={cn("text-[10px] shrink-0", escalationColor)}>
            {escalationLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-destructive/10 rounded-lg p-1.5">
            <p className="text-[9px] text-muted-foreground uppercase">Outstanding</p>
            <p className="text-xs font-bold text-destructive">₹{d.totalOutstanding.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-1.5">
            <p className="text-[9px] text-muted-foreground uppercase">Overdue</p>
            <p className="text-xs font-bold text-warning">{d.maxOverdueDays}d</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-1.5">
            <p className="text-[9px] text-muted-foreground uppercase">Reminders</p>
            <p className="text-xs font-bold text-primary">{d.reminderCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {d.lastReminderDate ? `Last reminder: ${d.lastReminderDate}` : "No reminders sent"}
          {d.hasPaymentInLast30Days && (
            <Badge variant="outline" className="ml-auto text-[9px] text-success border-success/30">
              Paid recently
            </Badge>
          )}
        </div>

        <div className="flex gap-1.5 pt-1">
          <Link to={`/customer/${encodeURIComponent(d.customerName)}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-[10px] gap-1 h-7">
              <Eye className="h-3 w-3" />View
            </Button>
          </Link>
          {d.mobileNo && (
            <a href={`tel:${d.mobileNo}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-[10px] gap-1 h-7">
                <Phone className="h-3 w-3" />Call
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VisitPlanner({ defaulters }: { defaulters: DefaulterInfo[] }) {
  const visitRequired = defaulters.filter(d => 
    d.escalationLevel === "visit" || d.escalationLevel === "final" || d.escalationLevel === "supply_stop"
  );

  const beatGroups = useMemo(() => {
    const map = new Map<string, DefaulterInfo[]>();
    for (const d of visitRequired) {
      const existing = map.get(d.beat);
      if (existing) existing.push(d);
      else map.set(d.beat, [d]);
    }
    return Array.from(map.entries()).sort((a, b) => 
      b[1].reduce((s, d) => s + d.totalOutstanding, 0) - a[1].reduce((s, d) => s + d.totalOutstanding, 0)
    );
  }, [visitRequired]);

  if (visitRequired.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No customers require physical visits yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Route className="h-4 w-4" />
        <span>{visitRequired.length} customers need visits across {beatGroups.length} beats</span>
      </div>
      {beatGroups.map(([beat, customers]) => {
        const beatTotal = customers.reduce((s, d) => s + d.totalOutstanding, 0);
        return (
          <div key={beat} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {beat}
                <Badge variant="secondary" className="text-[10px]">{customers.length}</Badge>
              </h3>
              <span className="text-xs font-semibold text-destructive">
                ₹{beatTotal.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {customers.map(d => (
                <DefaulterCard key={d.customerName} d={d} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Defaulters = () => {
  const { data: invoices = [], isLoading: loadingInv } = useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });
  const { data: whatsappLog = [], isLoading: loadingLog } = useQuery({ queryKey: ["whatsapp-log"], queryFn: fetchWhatsAppLog });
  const { data: payments = [], isLoading: loadingPay } = useQuery({ queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments });

  const isLoading = loadingInv || loadingLog || loadingPay;

  const defaulters = useMemo(() => buildDefaulterList(invoices, whatsappLog, payments), [invoices, whatsappLog, payments]);

  const [filterLevel, setFilterLevel] = useState<EscalationLevel | "all">("all");

  const filtered = useMemo(() => {
    if (filterLevel === "all") return defaulters;
    return defaulters.filter(d => d.escalationLevel === filterLevel);
  }, [defaulters, filterLevel]);

  const stats = useMemo(() => {
    const total = defaulters.length;
    const visitRequired = defaulters.filter(d => ["visit", "final", "supply_stop"].includes(d.escalationLevel)).length;
    const totalAmount = defaulters.reduce((s, d) => s + d.totalOutstanding, 0);
    const firmPlus = defaulters.filter(d => d.escalationLevel !== "normal").length;
    return { total, visitRequired, totalAmount, firmPlus };
  }, [defaulters]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Defaulter Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">Track & escalate non-paying customers</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card className="border-0 shadow-sm bg-destructive/10">
                <CardContent className="p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">Total Due</p>
                  <p className="text-sm font-black text-destructive">₹{stats.totalAmount.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-warning/10">
                <CardContent className="p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">Defaulters</p>
                  <p className="text-sm font-black text-warning">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-orange-500/10">
                <CardContent className="p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">Escalated</p>
                  <p className="text-sm font-black text-orange-600">{stats.firmPlus}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-destructive/15">
                <CardContent className="p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase">Visit Required</p>
                  <p className="text-sm font-black text-destructive">{stats.visitRequired}</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="all" className="text-xs">
                  All Defaulters
                </TabsTrigger>
                <TabsTrigger value="escalated" className="text-xs">
                  Escalated
                </TabsTrigger>
                <TabsTrigger value="visits" className="text-xs">
                  Visit Planner
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-3 space-y-3">
                {/* Filter chips */}
                <div className="flex gap-1.5 flex-wrap">
                  {(["all", "firm", "visit", "final", "supply_stop"] as const).map(level => (
                    <Button
                      key={level}
                      variant={filterLevel === level ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterLevel(level)}
                      className="text-[10px] h-7"
                    >
                      {level === "all" ? "All" : getEscalationLabel(level)}
                      <Badge variant="secondary" className="ml-1 text-[9px] h-4">
                        {level === "all" ? defaulters.length : defaulters.filter(d => d.escalationLevel === level).length}
                      </Badge>
                    </Button>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map(d => (
                    <DefaulterCard key={d.customerName} d={d} />
                  ))}
                </div>

                {filtered.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No defaulters in this category
                  </div>
                )}
              </TabsContent>

              <TabsContent value="escalated" className="mt-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {defaulters.filter(d => d.escalationLevel !== "normal").map(d => (
                    <DefaulterCard key={d.customerName} d={d} />
                  ))}
                </div>
                {defaulters.filter(d => d.escalationLevel !== "normal").length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No escalated customers yet. Customers with 3+ reminders will appear here.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="visits" className="mt-3">
                <VisitPlanner defaulters={defaulters} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

export default Defaulters;
