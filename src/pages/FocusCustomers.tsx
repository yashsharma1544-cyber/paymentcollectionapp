import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments, fetchWhatsAppLog } from "@/lib/api";
import { InvoiceTable } from "@/components/InvoiceTable";
import { useFocusCustomers } from "@/hooks/use-focus-customers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, IndianRupee, TrendingUp, Users, AlertTriangle, Timer, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { getOverdueDays, calcAvgCollectionDays } from "@/lib/date-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

const FocusCustomers = () => {
  const { focusSet, isLoading: focusLoading } = useFocusCustomers();

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["recorded-payments"],
    queryFn: fetchRecordedPayments,
  });

  const focusInvoices = useMemo(
    () => invoices.filter((i) => focusSet.has(i.customerName)),
    [invoices, focusSet]
  );

  const focusPayments = useMemo(
    () => allPayments.filter((p) => focusSet.has(p.customerName)),
    [allPayments, focusSet]
  );

  const kpis = useMemo(() => {
    const totalOutstanding = focusInvoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = focusInvoices.reduce((s, i) => s + i.billAmount, 0);
    const totalCollected = focusInvoices
      .filter((i) => i.outstandingAmount > 0)
      .reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(focusInvoices.map((i) => i.customerName)).size;
    const overdueOutstanding = focusInvoices
      .filter((i) => getOverdueDays(i.billDate) > 0 && i.outstandingAmount > 0)
      .reduce((s, i) => s + i.outstandingAmount, 0);
    const collectionRate = totalBill > 0 ? Math.round((totalCollected / totalBill) * 100).toString() : "0";
    const avgCollectionDays = calcAvgCollectionDays(focusInvoices, focusPayments);
    return { totalOutstanding, totalCollected, customers, overdueOutstanding, collectionRate, avgCollectionDays };
  }, [focusInvoices, focusPayments]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Focus Customers</h1>
              <p className="text-[11px] text-muted-foreground">
                {kpis.customers} customer{kpis.customers !== 1 ? "s" : ""} marked for focus
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {isLoading || focusLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : focusSet.size === 0 ? (
          <div className="text-center py-20">
            <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">No focus customers yet</p>
            <p className="text-sm text-muted-foreground">
              Tap the ★ icon on any customer to add them to your focus list
            </p>
          </div>
        ) : (
          <>
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
                  <p className="text-xs sm:text-lg font-black text-success leading-tight truncate">₹{kpis.totalCollected.toLocaleString("en-IN")}</p>
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

            <InvoiceTable invoices={focusInvoices} onPaymentSuccess={() => refetch()} exportTitle="Focus Customers" />
          </>
        )}
      </main>
    </div>
  );
};

export default FocusCustomers;
