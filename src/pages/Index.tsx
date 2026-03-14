import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments } from "@/lib/api";
import { BeatChart } from "@/components/BeatChart";
import { InvoiceTable } from "@/components/InvoiceTable";
import { RefreshCw, Receipt, History, IndianRupee, Search, X, Users, FileText, TrendingUp, CalendarClock, Download, AlertTriangle, ClipboardList, Timer, ArrowLeft, Brain, Route, BarChart3, ShieldCheck, Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { getOverdueDays, calcAvgCollectionDays } from "@/lib/date-utils";
import { BulkWatiSend } from "@/components/BulkWatiSend";
import { DailyTarget } from "@/components/DailyTarget";
import { calculateAllHealthScores } from "@/lib/health-score";

const Index = () => {
  const {
    data: invoices = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["recorded-payments"],
    queryFn: fetchRecordedPayments,
  });



  const [globalSearch, setGlobalSearch] = useState("");
  const [showSlowPayers, setShowSlowPayers] = useState(false);
  const { currentUser, clearUser } = useUser();

  const searchResults = useMemo(() => {
    if (!globalSearch) return null;
    const q = globalSearch.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.customerName.toLowerCase().includes(q) ||
        inv.billNo.toLowerCase().includes(q) ||
        inv.mobileNo.includes(globalSearch)
    );
  }, [invoices, globalSearch]);

  // Compute slow payer customer names (avg > 30d)
  const slowPayerCustomers = useMemo(() => {
    const customerMap = new Map<string, { invoices: { billNo: string; billDate: string }[] }>();
    for (const inv of invoices) {
      if (!customerMap.has(inv.customerName)) customerMap.set(inv.customerName, { invoices: [] });
      customerMap.get(inv.customerName)!.invoices.push({ billNo: inv.billNo, billDate: inv.billDate });
    }
    const slow = new Set<string>();
    for (const [name, data] of customerMap) {
      const custPayments = allPayments.filter(p => data.invoices.some(i => i.billNo === p.billNo));
      const avg = calcAvgCollectionDays(data.invoices, custPayments);
      if (avg !== null && avg > 30) slow.add(name);
    }
    return slow;
  }, [invoices, allPayments]);

  const kpiInvoices = useMemo(() => {
    if (!showSlowPayers) return invoices;
    return invoices.filter(i => slowPayerCustomers.has(i.customerName));
  }, [invoices, showSlowPayers, slowPayerCustomers]);

  const kpiPayments = useMemo(() => {
    if (!showSlowPayers) return allPayments;
    return allPayments.filter(p => slowPayerCustomers.has(p.customerName));
  }, [allPayments, showSlowPayers, slowPayerCustomers]);

  const kpis = useMemo(() => {
    const totalOutstanding = kpiInvoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = kpiInvoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = kpiInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(kpiInvoices.map((i) => i.customerName)).size;
    const overdueOutstanding = kpiInvoices.filter((i) => getOverdueDays(i.billDate) > 0 && i.outstandingAmount > 0).reduce((s, i) => s + i.outstandingAmount, 0);
    const remainingOutstanding = totalOutstanding - overdueOutstanding;
    const collectionRate = totalBill > 0 ? Math.round((totalPaid / totalBill) * 100).toString() : "0";
    const avgCollectionDays = calcAvgCollectionDays(kpiInvoices, kpiPayments);
    return { totalOutstanding, totalPaid, customers, overdueOutstanding, remainingOutstanding, collectionRate, avgCollectionDays };
  }, [kpiInvoices, kpiPayments]);

  // Health scores
  const healthSummary = useMemo(() => {
    const scores = calculateAllHealthScores(invoices, allPayments);
    let good = 0, avg = 0, risky = 0;
    for (const h of scores.values()) {
      if (h.status === "Good") good++;
      else if (h.status === "Average") avg++;
      else risky++;
    }
    return { good, avg, risky };
  }, [invoices, allPayments]);

  // Today's payments for daily target
  const todayPayments = useMemo(() => {
    const now = new Date();
    return allPayments.filter(p => {
      if (!p.timestamp) return false;
      const match = p.timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      }
      const d = new Date(p.timestamp);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [allPayments]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10">
                <IndianRupee className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight leading-tight">Payment Collector</h1>
                <p className="text-[11px] text-muted-foreground">
                  Logged in as <span className="font-semibold text-foreground">{currentUser}</span>
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} className="shrink-0 sm:hidden">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 hidden sm:inline-flex">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/due-today" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                <CalendarClock className="h-3.5 w-3.5" />
                Due Today
              </Button>
            </Link>
            <Link to="/payments" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                <History className="h-3.5 w-3.5" />
                Payments Log
              </Button>
            </Link>
            <Link to="/daily-report" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                <ClipboardList className="h-3.5 w-3.5" />
                Daily Report
              </Button>
            </Link>
            <Link to="/crm" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                <CalendarClock className="h-3.5 w-3.5" />
                CRM
              </Button>
            </Link>
            <Link to="/monthly-report" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Monthly Report</span>
                <span className="sm:hidden">Monthly</span>
              </Button>
            </Link>
            <Link to="/route-planner" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                <Route className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Route Planner</span>
                <span className="sm:hidden">Route</span>
              </Button>
            </Link>
            <Link to="/predictions" className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Predictions</span>
                <span className="sm:hidden">AI</span>
              </Button>
            </Link>
            <Button
              variant={showSlowPayers ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowSlowPayers(!showSlowPayers); setGlobalSearch(""); }}
              className="gap-1 text-xs flex-1 sm:flex-none"
            >
              <Timer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Slow Payers</span>
              <span className="sm:hidden">Slow</span>
            </Button>
            <BulkWatiSend invoices={invoices} />
            <Link to="/install" className="sm:flex-none">
              <Button variant="outline" size="icon" className="text-xs">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {error ? (
          <div className="text-center py-20">
            <p className="text-destructive font-medium mb-2">Failed to load invoices</p>
            <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-20 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Daily Target */}
            <DailyTarget todayPayments={todayPayments} />

            {/* KPI Summary */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-3">
              <Card className="border-0 shadow-sm bg-destructive/10 overflow-hidden">
                <CardContent className="p-2 sm:p-3 text-center">
                  <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider truncate">Outstanding</p>
                  <p className="text-xs sm:text-lg font-black text-destructive leading-tight truncate">₹{kpis.totalOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-success/10 overflow-hidden">
                <CardContent className="p-2 sm:p-3 text-center">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider truncate">Collected</p>
                  <p className="text-xs sm:text-lg font-black text-success leading-tight truncate">₹{kpis.totalPaid.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10 overflow-hidden">
                <CardContent className="p-2 sm:p-3 text-center">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider truncate">Collection %</p>
                  <p className="text-xs sm:text-lg font-black text-primary leading-tight">{kpis.collectionRate}%</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-2 sm:p-3 text-center">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider truncate">Customers</p>
                  <p className="text-xs sm:text-lg font-black leading-tight">{kpis.customers}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-warning/10 overflow-hidden">
                <CardContent className="p-2 sm:p-3 text-center">
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider truncate">Overdue Amt</p>
                  <p className="text-xs sm:text-lg font-black text-warning leading-tight truncate">₹{kpis.overdueOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-orange-500/10 overflow-hidden">
                <CardContent className="p-2 sm:p-3 text-center">
                  <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider truncate">Avg Collection</p>
                  <p className="text-xs sm:text-lg font-black text-orange-600 leading-tight">{kpis.avgCollectionDays !== null ? `${kpis.avgCollectionDays}d` : "—"}</p>
                </CardContent>
              </Card>
            </div>


            {/* Global Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, bill no, or mobile..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9 pr-9"
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {searchResults ? (
              <InvoiceTable invoices={searchResults} onPaymentSuccess={() => refetch()} />
            ) : showSlowPayers ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSlowPayers(false)} className="gap-1.5 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Dashboard
                  </Button>
                  <h2 className="text-sm font-semibold text-muted-foreground">Slow Payers (Avg &gt; 30d)</h2>
                </div>
                <InvoiceTable invoices={invoices} onPaymentSuccess={() => refetch()} exportTitle="Slow Payers" defaultSlowPayer />
              </div>
            ) : (
              <BeatChart invoices={invoices} payments={allPayments} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
