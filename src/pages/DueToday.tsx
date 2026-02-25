import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/lib/api";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, IndianRupee, TrendingUp, Users, FileText, AlertTriangle,
  CalendarClock, MapPin, MessageCircle,
} from "lucide-react";
import type { Invoice } from "@/lib/invoice";
import { getOverdueDays, formatOverdue, isToday, isTodayOrBefore } from "@/lib/date-utils";
import { buildReminderMessage, openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";

type SortKey = "customer" | "outstanding" | "dueDate" | "overdue";

function sortInvoices(invoices: Invoice[], sortBy: SortKey): Invoice[] {
  return [...invoices].sort((a, b) => {
    switch (sortBy) {
      case "customer":
        return a.customerName.localeCompare(b.customerName);
      case "outstanding":
        return b.outstandingAmount - a.outstandingAmount;
      case "dueDate": {
        const da = getOverdueDays(a.dueDate);
        const db = getOverdueDays(b.dueDate);
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
    const overdueOutstanding = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).reduce((s, i) => s + i.outstandingAmount, 0);
    const remainingOutstanding = totalOutstanding - overdueOutstanding;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    return { totalOutstanding, totalPaid, customers, overdueOutstanding, remainingOutstanding, collectionRate };
  }, [invoices]);

  return (
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
  filterParam = "due-today",
}: {
  invoices: Invoice[];
  onPaymentSuccess: () => void;
  filterParam?: string;
}) {
  const beatGroups = useMemo(() => groupByBeat(invoices), [invoices]);

  const customerGroups = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; invoices: Invoice[] }>();
    for (const inv of invoices) {
      if (!map.has(inv.customerName)) {
        map.set(inv.customerName, { name: inv.customerName, phone: inv.mobileNo, invoices: [] });
      }
      map.get(inv.customerName)!.invoices.push(inv);
    }
    return Array.from(map.values()).filter((c) => c.phone);
  }, [invoices]);

  const handleBulkWhatsApp = () => {
    if (customerGroups.length === 0) {
      toast.info("No customers with phone numbers to send reminders to");
      return;
    }
    let opened = 0;
    const delay = 800; // stagger to avoid browser blocking
    customerGroups.forEach((cg, i) => {
      const msg = buildReminderMessage(cg.name, cg.invoices);
      if (msg) {
        setTimeout(() => openWhatsApp(cg.phone, msg), i * delay);
        opened++;
      }
    });
    toast.success(`Opening WhatsApp for ${opened} customer${opened !== 1 ? "s" : ""}...`);
  };

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
        No invoices found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleBulkWhatsApp}
          className="gap-2 text-green-600 border-green-600 hover:bg-green-50"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp All ({customerGroups.length})
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
        {beatGroups.map((bg, i) => {
          const color = BEAT_COLORS[i % BEAT_COLORS.length];
          return (
            <Link
              key={bg.beat}
              to={`/beat/${encodeURIComponent(bg.beat)}?filter=${filterParam}`}
              className={`rounded-xl p-3 sm:p-4 text-center transition-all hover:scale-[1.03] active:scale-[0.98] shadow-sm ${color.bg} ${color.text} block w-full`}
            >
              <div className="flex items-center justify-center gap-1 mb-1.5">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-80 shrink-0" />
                <p className="text-xs sm:text-sm font-bold truncate">{bg.beat}</p>
              </div>
              <p className="text-lg sm:text-2xl font-black tracking-tight">
                ₹{bg.totalOutstanding.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] sm:text-[11px] opacity-75 mt-0.5">
                {bg.customers} cust · {bg.invoices.length} bill{bg.invoices.length !== 1 ? "s" : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
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
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="p-2 rounded-lg bg-destructive/10">
              <CalendarClock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Due Today</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Invoices due today &amp; overdue pending</p>
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
            <TabsList className="mb-4 w-full sm:w-auto">
              <TabsTrigger value="due-today" className="gap-1 sm:gap-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                Due Today ({dueToday.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1 sm:gap-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Pending ({pending.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="due-today" className="space-y-4">
              <KPICards invoices={dueToday} />
              <InvoiceList invoices={dueToday} onPaymentSuccess={() => refetch()} />
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <KPICards invoices={pending} />
              <InvoiceList invoices={pending} onPaymentSuccess={() => refetch()} filterParam="pending" />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default DueToday;
