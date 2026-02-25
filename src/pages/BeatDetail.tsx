import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/lib/api";
import { InvoiceTable } from "@/components/InvoiceTable";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, IndianRupee, Users, FileText, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { useMemo } from "react";

function parseDateDMY(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-\/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function isTodayOrBefore(dateStr: string): boolean {
  const d = parseDateDMY(dateStr);
  if (!d) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d <= now;
}

const BeatDetail = () => {
  const { beatName } = useParams<{ beatName: string }>();
  const decodedBeat = decodeURIComponent(beatName || "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dueTodayFilter = searchParams.get("filter") === "due-today";

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
    if (dueTodayFilter) {
      filtered = filtered.filter((inv) => isTodayOrBefore(inv.dueDate) && inv.outstandingAmount > 0);
    }
    return filtered;
  }, [allInvoices, decodedBeat, dueTodayFilter]);

  const kpis = useMemo(() => {
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(invoices.map((i) => i.customerName)).size;
    const overdueInvoices = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).length;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    return { totalOutstanding, totalBill, totalPaid, customers, overdueInvoices, collectionRate, invoiceCount: invoices.length };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{decodedBeat}</h1>
              <p className="text-xs text-muted-foreground">
                {dueTodayFilter ? "Due & Overdue Invoices" : "Beat Details"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
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
              {dueTodayFilter ? "No due or overdue invoices for this beat" : "No invoices found for this beat"}
            </p>
            <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm bg-destructive/10">
                <CardContent className="p-4 text-center">
                  <IndianRupee className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                  <p className="text-xl font-black text-destructive">₹{kpis.totalOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-success/10">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
                  <p className="text-xl font-black text-success">₹{kpis.totalPaid.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collection Rate</p>
                  <p className="text-xl font-black text-primary">{kpis.collectionRate}%</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <Users className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Customers</p>
                  <p className="text-xl font-black">{kpis.customers}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <FileText className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoices</p>
                  <p className="text-xl font-black">{kpis.invoiceCount}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-warning/10">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                  <p className="text-xl font-black text-warning">{kpis.overdueInvoices}</p>
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
