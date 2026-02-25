import { useQuery } from "@tanstack/react-query";
import { fetchRecordedPayments } from "@/lib/api";
import { fetchInvoices } from "@/lib/api";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, RefreshCw, IndianRupee,
  Users, MapPin, FileText,
} from "lucide-react";
import { Link } from "react-router-dom";

interface CustomerSummary {
  customerName: string;
  beat: string;
  totalCollected: number;
  invoiceCount: number;
}

const DailyReport = () => {
  const { data: payments = [], isLoading: loadingPayments, refetch: refetchPayments, isFetching: fetchingPayments } = useQuery({
    queryKey: ["recorded-payments"],
    queryFn: fetchRecordedPayments,
  });

  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices, isFetching: fetchingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const isLoading = loadingPayments || loadingInvoices;
  const isFetching = fetchingPayments || fetchingInvoices;

  const refetch = () => {
    refetchPayments();
    refetchInvoices();
  };

  // Build a map of customerName → beat from invoices
  const customerBeatMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of invoices) {
      if (!map.has(inv.customerName)) {
        map.set(inv.customerName, inv.beat);
      }
    }
    return map;
  }, [invoices]);

  // Group all payments by customer
  const { customers, totalCollected, totalBills } = useMemo(() => {
    const map = new Map<string, { totalCollected: number; bills: Set<string> }>();
    for (const p of payments) {
      if (p.paidAmount <= 0) continue;
      if (!map.has(p.customerName)) {
        map.set(p.customerName, { totalCollected: 0, bills: new Set() });
      }
      const entry = map.get(p.customerName)!;
      entry.totalCollected += p.paidAmount;
      entry.bills.add(p.billNo);
    }

    const customers: CustomerSummary[] = Array.from(map.entries())
      .map(([name, d]) => ({
        customerName: name,
        beat: customerBeatMap.get(name) || "Unknown",
        totalCollected: d.totalCollected,
        invoiceCount: d.bills.size,
      }))
      .sort((a, b) => b.totalCollected - a.totalCollected);

    const totalCollected = customers.reduce((s, c) => s + c.totalCollected, 0);
    const totalBills = customers.reduce((s, c) => s + c.invoiceCount, 0);

    return { customers, totalCollected, totalBills };
  }, [payments, customerBeatMap]);

  const uniqueBeats = useMemo(() => new Set(customers.map((c) => c.beat)).size, [customers]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <IndianRupee className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">Collection Report</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Customers visited & amounts collected</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="shrink-0 sm:hidden" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching} className="gap-2 hidden sm:inline-flex">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Card className="border-0 shadow-sm bg-success/10">
                <CardContent className="p-2 sm:p-3 text-center">
                  <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Collected</p>
                  <p className="text-xs sm:text-lg font-black text-success leading-tight truncate">
                    ₹{totalCollected.toLocaleString("en-IN")}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10">
                <CardContent className="p-2 sm:p-3 text-center">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Customers</p>
                  <p className="text-xs sm:text-lg font-black text-primary leading-tight">{customers.length}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-2 sm:p-3 text-center">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Beats</p>
                  <p className="text-xs sm:text-lg font-black leading-tight">{uniqueBeats}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-2 sm:p-3 text-center">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Bills</p>
                  <p className="text-xs sm:text-lg font-black leading-tight">{totalBills}</p>
                </CardContent>
              </Card>
            </div>

            {/* Customer Table */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Customer</TableHead>
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Beat</TableHead>
                      <TableHead className="font-semibold text-xs text-center whitespace-nowrap">Bills</TableHead>
                      <TableHead className="font-semibold text-xs text-right whitespace-nowrap">Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          No collections recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {customers.map((c, i) => (
                          <TableRow key={`${c.customerName}-${i}`} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium text-xs max-w-[120px] sm:max-w-none truncate">
                              <Link to={`/customer/${encodeURIComponent(c.customerName)}`} className="hover:underline text-primary">
                                {c.customerName}
                              </Link>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {c.beat}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-center">{c.invoiceCount}</TableCell>
                            <TableCell className="text-right font-semibold text-success text-xs whitespace-nowrap">
                              ₹{c.totalCollected.toLocaleString("en-IN")}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell className="text-xs">Total</TableCell>
                          <TableCell />
                          <TableCell className="text-xs text-center">{totalBills}</TableCell>
                          <TableCell className="text-right text-success text-xs">
                            ₹{totalCollected.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default DailyReport;
