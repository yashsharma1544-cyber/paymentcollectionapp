import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments } from "@/lib/api";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, IndianRupee, TrendingUp, Users, MapPin, AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateAllHealthScores } from "@/lib/health-score";
import { HealthBadge } from "@/components/HealthBadge";
import { parseDateDMY } from "@/lib/date-utils";

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    });
  }
  return options;
}

function parseTimestamp(ts: string): Date | null {
  if (!ts) return null;
  const match = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

const MonthlyReport = () => {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

  const { data: invoices = [], isLoading: il, refetch: r1, isFetching: f1 } = useQuery({
    queryKey: ["invoices"], queryFn: fetchInvoices,
  });
  const { data: payments = [], isLoading: pl, refetch: r2, isFetching: f2 } = useQuery({
    queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments,
  });

  const isLoading = il || pl;
  const isFetching = f1 || f2;
  const refetch = () => { r1(); r2(); };

  const [year, month] = selectedMonth.split("-").map(Number);

  // Payments in selected month
  const monthPayments = useMemo(() => {
    return payments.filter(p => {
      const ts = parseTimestamp(p.timestamp);
      if (!ts) return false;
      return ts.getFullYear() === year && ts.getMonth() + 1 === month;
    });
  }, [payments, year, month]);

  const totalCollected = useMemo(() => monthPayments.reduce((s, p) => s + p.paidAmount, 0), [monthPayments]);
  const totalBilled = useMemo(() => invoices.reduce((s, i) => s + i.billAmount, 0), [invoices]);
  const totalOutstanding = useMemo(() => invoices.reduce((s, i) => s + i.outstandingAmount, 0), [invoices]);

  // Top defaulters
  const defaulters = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.outstandingAmount > 0) {
        map.set(inv.customerName, (map.get(inv.customerName) || 0) + inv.outstandingAmount);
      }
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [invoices]);

  // Beat-wise performance
  const beatPerformance = useMemo(() => {
    const map = new Map<string, { billed: number; outstanding: number; collected: number; customers: Set<string> }>();
    for (const inv of invoices) {
      if (!map.has(inv.beat)) map.set(inv.beat, { billed: 0, outstanding: 0, collected: 0, customers: new Set() });
      const e = map.get(inv.beat)!;
      e.billed += inv.billAmount;
      e.outstanding += inv.outstandingAmount;
      e.customers.add(inv.customerName);
    }
    for (const p of monthPayments) {
      const inv = invoices.find(i => i.billNo === p.billNo);
      if (inv && map.has(inv.beat)) {
        map.get(inv.beat)!.collected += p.paidAmount;
      }
    }
    return Array.from(map.entries())
      .map(([beat, d]) => ({
        beat,
        billed: d.billed,
        outstanding: d.outstanding,
        collected: d.collected,
        customers: d.customers.size,
        collectionRate: d.billed > 0 ? Math.round(((d.billed - d.outstanding) / d.billed) * 100) : 0,
      }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices, monthPayments]);

  // Health scores
  const healthScores = useMemo(() => calculateAllHealthScores(invoices, payments), [invoices, payments]);
  const healthSummary = useMemo(() => {
    let good = 0, avg = 0, risky = 0;
    for (const h of healthScores.values()) {
      if (h.status === "Good") good++;
      else if (h.status === "Average") avg++;
      else risky++;
    }
    return { good, avg, risky };
  }, [healthScores]);

  // Unique customers who paid this month
  const uniquePayers = useMemo(() => new Set(monthPayments.map(p => p.customerName)).size, [monthPayments]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/"><Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <div className="p-2 rounded-lg bg-primary/10 shrink-0"><IndianRupee className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">Monthly Report</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Collection summary & performance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refetch} disabled={isFetching}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {isLoading ? <Skeleton className="h-96 rounded-xl" /> : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Card className="border-0 shadow-sm bg-success/10">
                <CardContent className="p-2 sm:p-3 text-center">
                  <IndianRupee className="h-3.5 w-3.5 text-success mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Month Collection</p>
                  <p className="text-xs sm:text-lg font-black text-success truncate">₹{totalCollected.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-destructive/10">
                <CardContent className="p-2 sm:p-3 text-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Total Outstanding</p>
                  <p className="text-xs sm:text-lg font-black text-destructive truncate">₹{totalOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10">
                <CardContent className="p-2 sm:p-3 text-center">
                  <Users className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Customers Paid</p>
                  <p className="text-xs sm:text-lg font-black text-primary">{uniquePayers}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-2 sm:p-3 text-center">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Collection Ratio</p>
                  <p className="text-xs sm:text-lg font-black">{totalBilled > 0 ? Math.round(((totalBilled - totalOutstanding) / totalBilled) * 100) : 0}%</p>
                </CardContent>
              </Card>
            </div>

            {/* Health Summary */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Health:</span>
              <span className="text-xs font-semibold text-success bg-success/10 px-2 py-1 rounded-full">{healthSummary.good} Good</span>
              <span className="text-xs font-semibold text-warning bg-warning/10 px-2 py-1 rounded-full">{healthSummary.avg} Average</span>
              <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-full">{healthSummary.risky} Risky</span>
            </div>

            {/* Top Defaulters */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Top Defaulters
              </h2>
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold">#</TableHead>
                      <TableHead className="text-xs font-semibold">Customer</TableHead>
                      <TableHead className="text-xs font-semibold">Health</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defaulters.map((d, i) => {
                      const health = healthScores.get(d.name);
                      return (
                        <TableRow key={d.name}>
                          <TableCell className="text-xs font-mono">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">
                            <Link to={`/customer/${encodeURIComponent(d.name)}`} className="hover:underline text-primary">{d.name}</Link>
                          </TableCell>
                          <TableCell>{health && <HealthBadge status={health.status} />}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-destructive">₹{d.amount.toLocaleString("en-IN")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Beat-wise Performance */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Beat-wise Performance
              </h2>
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold">Beat</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Customers</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Month Collection</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Collection %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {beatPerformance.map(b => (
                        <TableRow key={b.beat}>
                          <TableCell className="text-xs font-medium">
                            <Link to={`/beat/${encodeURIComponent(b.beat)}`} className="hover:underline text-primary">{b.beat}</Link>
                          </TableCell>
                          <TableCell className="text-xs text-center">{b.customers}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-destructive">₹{b.outstanding.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-success">₹{b.collected.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${b.collectionRate >= 80 ? "text-success bg-success/10" : b.collectionRate >= 50 ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10"}`}>
                              {b.collectionRate}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default MonthlyReport;
