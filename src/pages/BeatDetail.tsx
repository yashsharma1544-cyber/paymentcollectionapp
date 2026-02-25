import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/lib/api";
import { InvoiceTable } from "@/components/InvoiceTable";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, IndianRupee, Users, FileText, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { isTodayOrBefore, isToday } from "@/lib/date-utils";

const BeatDetail = () => {
  const { beatName } = useParams<{ beatName: string }>();
  const decodedBeat = decodeURIComponent(beatName || "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get("filter"); // "due-today" or "pending"

  const {
    data: allInvoices = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const invoices = useMemo(() => {
    let filtered = allInvoices.filter((inv) => inv.beat === decodedBeat);
    if (filterType === "due-today") {
      filtered = filtered.filter((inv) => isToday(inv.dueDate) && inv.outstandingAmount > 0);
    } else if (filterType === "pending") {
      filtered = filtered.filter((inv) => isTodayOrBefore(inv.dueDate) && inv.outstandingAmount > 0);
    }
    return filtered;
  }, [allInvoices, decodedBeat, filterType]);

  const kpis = useMemo(() => {
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(invoices.map((i) => i.customerName)).size;
    const overdueOutstanding = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).reduce((s, i) => s + i.outstandingAmount, 0);
    const remainingOutstanding = totalOutstanding - overdueOutstanding;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    return { totalOutstanding, totalBill, totalPaid, customers, overdueOutstanding, remainingOutstanding, collectionRate };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">{decodedBeat}</h1>
              <p className="text-[11px] text-muted-foreground">
                {filterType === "due-today" ? "Due Today" : filterType === "pending" ? "Due & Overdue" : "Beat Details"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="shrink-0 sm:hidden" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 hidden sm:inline-flex">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {error ? (
          <div className="text-center py-20">
            <p className="text-destructive font-medium mb-2">Failed to load data</p>
            <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              {filterType ? "No matching invoices for this beat" : "No invoices found for this beat"}
            </p>
            <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        ) : (
          <>
             <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
              <Card className="border-0 shadow-sm bg-destructive/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <IndianRupee className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-destructive mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Outstanding</p>
                  <p className="text-xs sm:text-xl font-black text-destructive leading-tight truncate">₹{kpis.totalOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-success/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-success mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Collected</p>
                  <p className="text-xs sm:text-xl font-black text-success leading-tight truncate">₹{kpis.totalPaid.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-primary mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Collection %</p>
                  <p className="text-xs sm:text-xl font-black text-primary leading-tight">{kpis.collectionRate}%</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <Users className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Customers</p>
                  <p className="text-xs sm:text-xl font-black leading-tight">{kpis.customers}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-warning/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-warning mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Overdue Amt</p>
                  <p className="text-xs sm:text-xl font-black text-warning leading-tight truncate">₹{kpis.overdueOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <IndianRupee className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Remaining</p>
                  <p className="text-xs sm:text-xl font-black leading-tight truncate">₹{kpis.remainingOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
            </div>

            <InvoiceTable invoices={invoices} onPaymentSuccess={() => refetch()} />
          </>
        )}
      </main>
    </div>
  );
};

export default BeatDetail;
