import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/lib/api";
import { BeatChart } from "@/components/BeatChart";
import { InvoiceTable } from "@/components/InvoiceTable";
import { RefreshCw, Receipt, History, IndianRupee, Search, X, Users, FileText, TrendingUp, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";

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
    const beats = new Set(invoices.map((i) => i.beat)).size;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    return { totalOutstanding, totalPaid, customers, beats, collectionRate, invoiceCount: invoices.length };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Payment Collector</h1>
              <p className="text-xs text-muted-foreground">Manage invoices & collect payments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/due-today">
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarClock className="h-4 w-4" />
                Due Today
              </Button>
            </Link>
            <Link to="/payments">
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                Payments Log
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
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
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="border-0 shadow-sm bg-destructive/10 col-span-1">
                <CardContent className="p-3 text-center">
                  <IndianRupee className="h-4 w-4 text-destructive mx-auto mb-0.5" />
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                  <p className="text-lg font-black text-destructive leading-tight">₹{kpis.totalOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-success/10">
                <CardContent className="p-3 text-center">
                  <TrendingUp className="h-4 w-4 text-success mx-auto mb-0.5" />
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Collected</p>
                  <p className="text-lg font-black text-success leading-tight">₹{kpis.totalPaid.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10">
                <CardContent className="p-3 text-center">
                  <TrendingUp className="h-4 w-4 text-primary mx-auto mb-0.5" />
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Collection %</p>
                  <p className="text-lg font-black text-primary leading-tight">{kpis.collectionRate}%</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 text-center">
                  <Users className="h-4 w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Customers</p>
                  <p className="text-lg font-black leading-tight">{kpis.customers}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 text-center">
                  <FileText className="h-4 w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Invoices</p>
                  <p className="text-lg font-black leading-tight">{kpis.invoiceCount}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 text-center">
                  <FileText className="h-4 w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Beats</p>
                  <p className="text-lg font-black leading-tight">{kpis.beats}</p>
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
