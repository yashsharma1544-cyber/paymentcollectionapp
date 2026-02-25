import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/lib/api";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentDialog } from "@/components/PaymentDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, IndianRupee, TrendingUp, Users, FileText, AlertTriangle, CalendarClock, CreditCard,
} from "lucide-react";
import type { Invoice } from "@/lib/invoice";

function parseDateDMY(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try DD-MM-YYYY or DD/MM/YYYY
  const parts = dateStr.split(/[-\/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }
  // Fallback
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function isToday(dateStr: string): boolean {
  const d = parseDateDMY(dateStr);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isTodayOrBefore(dateStr: string): boolean {
  const d = parseDateDMY(dateStr);
  if (!d) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d <= now;
}

function KPICards({ invoices, label }: { invoices: Invoice[]; label: string }) {
  const kpis = useMemo(() => {
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(invoices.map((i) => i.customerName)).size;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    return { totalOutstanding, totalPaid, customers, collectionRate, invoiceCount: invoices.length };
  }, [invoices]);

  return (
    <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
      <Card className="border-0 shadow-sm bg-destructive/10">
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
    </div>
  );
}

function InvoiceList({ invoices, onPaymentSuccess }: { invoices: Invoice[]; onPaymentSuccess: () => void }) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
        No invoices found
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">Customer</TableHead>
              <TableHead className="text-xs font-semibold">Bill No</TableHead>
              <TableHead className="text-xs font-semibold">Beat</TableHead>
              <TableHead className="text-xs font-semibold text-right">Bill Amt</TableHead>
              <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
              <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
              <TableHead className="text-xs font-semibold">Due Date</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.billNo} className="hover:bg-muted/20 transition-colors">
                <TableCell className="text-xs">
                  <Link
                    to={`/customer/${encodeURIComponent(inv.customerName)}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {inv.customerName}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{inv.billNo}</TableCell>
                <TableCell className="text-xs">{inv.beat}</TableCell>
                <TableCell className="text-right text-xs font-medium">₹{inv.billAmount.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right text-xs text-success font-medium">₹{inv.paidAmount.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right text-xs text-destructive font-semibold">₹{inv.outstandingAmount.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-xs">{inv.dueDate}</TableCell>
                <TableCell><StatusBadge status={inv.paymentStatus} /></TableCell>
                <TableCell className="text-center">
                  {inv.outstandingAmount > 0 && (
                    <Button
                      size="sm"
                      onClick={() => { setSelectedInvoice(inv); setDialogOpen(true); }}
                      className="gap-1.5 h-7 text-xs"
                    >
                      <CreditCard className="h-3 w-3" />
                      Collect
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaymentDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={onPaymentSuccess}
      />
    </>
  );
}

const DueToday = () => {
  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const dueToday = useMemo(
    () => invoices.filter((inv) => isToday(inv.dueDate) && inv.outstandingAmount > 0),
    [invoices]
  );

  const pending = useMemo(
    () => invoices.filter((inv) => isTodayOrBefore(inv.dueDate) && inv.outstandingAmount > 0),
    [invoices]
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="p-2 rounded-lg bg-destructive/10">
              <CalendarClock className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Due Today</h1>
              <p className="text-xs text-muted-foreground">Invoices due today &amp; overdue pending</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {error ? (
          <div className="text-center py-20">
            <p className="text-destructive font-medium mb-2">Failed to load invoices</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <Tabs defaultValue="due-today">
            <TabsList className="mb-4">
              <TabsTrigger value="due-today" className="gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Due Today ({dueToday.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Pending ({pending.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="due-today" className="space-y-4">
              <KPICards invoices={dueToday} label="Due Today" />
              <InvoiceList invoices={dueToday} onPaymentSuccess={() => refetch()} />
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <KPICards invoices={pending} label="Pending" />
              <InvoiceList invoices={pending} onPaymentSuccess={() => refetch()} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default DueToday;
