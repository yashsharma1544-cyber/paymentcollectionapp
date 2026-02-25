import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchFollowUps, type FollowUp } from "@/lib/api";
import { BeatChart } from "@/components/BeatChart";
import { InvoiceTable } from "@/components/InvoiceTable";
import { RefreshCw, Receipt, History, IndianRupee, Search, X, Users, FileText, TrendingUp, CalendarClock, Download, AlertTriangle, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { FollowUpList } from "@/components/FollowUpList";

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

  const { data: allFollowUps = [] } = useQuery({
    queryKey: ["followups"],
    queryFn: fetchFollowUps,
  });

  const todayFollowUps = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return allFollowUps.filter((f) => {
      if (f.status !== "Pending") return false;
      const dateStr = f.nextFollowUpDate;
      if (!dateStr) return false;
      let d: Date | null = null;
      if (dateStr.includes("-") && dateStr.length === 10) {
        d = new Date(dateStr + "T00:00:00");
      } else {
        const parts = dateStr.split("/");
        if (parts.length === 3) d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
      if (!d || isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d <= now;
    });
  }, [allFollowUps]);

  const [globalSearch, setGlobalSearch] = useState("");

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

  const kpis = useMemo(() => {
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(invoices.map((i) => i.customerName)).size;
    const overdueOutstanding = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).reduce((s, i) => s + i.outstandingAmount, 0);
    const remainingOutstanding = totalOutstanding - overdueOutstanding;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    return { totalOutstanding, totalPaid, customers, overdueOutstanding, remainingOutstanding, collectionRate };
  }, [invoices]);

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
                <p className="text-[11px] text-muted-foreground hidden sm:block">Manage invoices & collect payments</p>
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
          <div className="flex items-center gap-2">
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
            {/* KPI Summary */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-3">
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
            </div>

            {/* Follow-ups Due Today */}
            {todayFollowUps.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    Follow-ups Due ({todayFollowUps.length})
                  </h2>
                  <Link to="/crm">
                    <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
                  </Link>
                </div>
                <FollowUpList followUps={todayFollowUps} showCustomerName />
              </div>
            )}

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
            ) : (
              <BeatChart invoices={invoices} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
