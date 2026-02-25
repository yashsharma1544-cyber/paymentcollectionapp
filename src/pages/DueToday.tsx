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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, IndianRupee, TrendingUp, Users, FileText, AlertTriangle,
  CalendarClock, CreditCard, ArrowUpDown, ChevronDown, ChevronRight, User, MapPin,
} from "lucide-react";
import type { Invoice } from "@/lib/invoice";

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

function getOverdueDays(dateStr: string): number {
  const d = parseDateDMY(dateStr);
  if (!d) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
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

type SortKey = "customer" | "outstanding" | "dueDate" | "overdue";

function sortInvoices(invoices: Invoice[], sortBy: SortKey): Invoice[] {
  return [...invoices].sort((a, b) => {
    switch (sortBy) {
      case "customer":
        return a.customerName.localeCompare(b.customerName);
      case "outstanding":
        return b.outstandingAmount - a.outstandingAmount;
      case "dueDate": {
        const da = parseDateDMY(a.dueDate)?.getTime() || 0;
        const db = parseDateDMY(b.dueDate)?.getTime() || 0;
        return da - db;
      }
      case "overdue":
        return getOverdueDays(b.dueDate) - getOverdueDays(a.dueDate);
      default:
        return 0;
    }
  });
}

function KPICards({ invoices }: { invoices: Invoice[] }) {
  const kpis = useMemo(() => {
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(invoices.map((i) => i.customerName)).size;
    const beats = new Set(invoices.map((i) => i.beat)).size;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    return { totalOutstanding, totalPaid, customers, collectionRate, invoiceCount: invoices.length, beats };
  }, [invoices]);

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
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
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 text-center">
          <MapPin className="h-4 w-4 text-muted-foreground mx-auto mb-0.5" />
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Beats</p>
          <p className="text-lg font-black leading-tight">{kpis.beats}</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface BeatGroup {
  beat: string;
  invoices: Invoice[];
  totalOutstanding: number;
  customers: number;
}

function groupByBeat(invoices: Invoice[]): BeatGroup[] {
  const map = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (!map.has(inv.beat)) map.set(inv.beat, []);
    map.get(inv.beat)!.push(inv);
  }
  return Array.from(map.entries())
    .map(([beat, invs]) => ({
      beat,
      invoices: invs,
      totalOutstanding: invs.reduce((s, i) => s + i.outstandingAmount, 0),
      customers: new Set(invs.map((i) => i.customerName)).size,
    }))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

const BEAT_COLORS = [
  { bg: "bg-[#DBEAFE]", text: "text-[#1e40af]" },
  { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  { bg: "bg-[#FFEDD5]", text: "text-[#9a3412]" },
  { bg: "bg-[#F3E8FF]", text: "text-[#6b21a8]" },
  { bg: "bg-[#FEE2E2]", text: "text-[#991b1b]" },
  { bg: "bg-[#CFFAFE]", text: "text-[#155e75]" },
  { bg: "bg-[#FEF9C3]", text: "text-[#854d0e]" },
  { bg: "bg-[#FCE7F3]", text: "text-[#9d174d]" },
  { bg: "bg-[#E0E7FF]", text: "text-[#3730a3]" },
  { bg: "bg-[#D1FAE5]", text: "text-[#065f46]" },
];

function InvoiceList({
  invoices,
  onPaymentSuccess,
  showOverdue = false,
}: {
  invoices: Invoice[];
  onPaymentSuccess: () => void;
  showOverdue?: boolean;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("outstanding");
  const [selectedBeat, setSelectedBeat] = useState<string | null>(null);

  const sorted = useMemo(() => sortInvoices(invoices, sortBy), [invoices, sortBy]);
  const beatGroups = useMemo(() => groupByBeat(sorted), [sorted]);

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
        No invoices found
      </div>
    );
  }

  const activeBeat = selectedBeat ? beatGroups.find((b) => b.beat === selectedBeat) : null;
  const activeBeatInvoices = activeBeat ? sortInvoices(activeBeat.invoices, sortBy) : [];

  return (
    <>
      {/* Beat boxes grid — same style as dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {beatGroups.map((bg, i) => {
          const color = BEAT_COLORS[i % BEAT_COLORS.length];
          const isActive = selectedBeat === bg.beat;
          return (
            <button
              key={bg.beat}
              onClick={() => setSelectedBeat(isActive ? null : bg.beat)}
              className={`rounded-xl p-4 text-center transition-all hover:scale-[1.03] active:scale-[0.98] shadow-sm ${color.bg} ${color.text} block w-full ${isActive ? "ring-2 ring-offset-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <MapPin className="h-4 w-4 opacity-80" />
                <p className="text-sm font-bold truncate">{bg.beat}</p>
              </div>
              <p className="text-2xl font-black tracking-tight">
                ₹{bg.totalOutstanding.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] opacity-75 mt-1">
                {bg.customers} customer{bg.customers !== 1 ? "s" : ""} · {bg.invoices.length} bill{bg.invoices.length !== 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded invoice table for selected beat */}
      {activeBeat && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{activeBeat.beat} — Invoices</p>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outstanding">Outstanding (High→Low)</SelectItem>
                  <SelectItem value="customer">Customer Name</SelectItem>
                  <SelectItem value="dueDate">Due Date (Earliest)</SelectItem>
                  {showOverdue && <SelectItem value="overdue">Overdue Days</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Customer</TableHead>
                  <TableHead className="text-xs font-semibold">Bill No</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Bill Amt</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
                  <TableHead className="text-xs font-semibold">Due Date</TableHead>
                  {showOverdue && <TableHead className="text-xs font-semibold text-center">Overdue</TableHead>}
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBeatInvoices.map((inv) => {
                  const overdueDays = getOverdueDays(inv.dueDate);
                  return (
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
                      <TableCell className="text-right text-xs font-medium">₹{inv.billAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right text-xs text-success font-medium">₹{inv.paidAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right text-xs text-destructive font-semibold">₹{inv.outstandingAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs">{inv.dueDate}</TableCell>
                      {showOverdue && (
                        <TableCell className="text-center">
                          <span className={`text-xs font-bold ${overdueDays > 0 ? "text-destructive" : "text-success"}`}>
                            {overdueDays > 0 ? `${overdueDays}d` : "Today"}
                          </span>
                        </TableCell>
                      )}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

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
              <KPICards invoices={dueToday} />
              <InvoiceList invoices={dueToday} onPaymentSuccess={() => refetch()} />
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <KPICards invoices={pending} />
              <InvoiceList invoices={pending} onPaymentSuccess={() => refetch()} showOverdue />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default DueToday;
