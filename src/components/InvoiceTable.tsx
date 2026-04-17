import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentDialog } from "@/components/PaymentDialog";
import { Link } from "react-router-dom";
import type { Invoice } from "@/lib/invoice";
import { calculateHealthScore } from "@/lib/health-score";
import { HealthBadge } from "@/components/HealthBadge";
import { sortInvoicesUnpaidFirst } from "@/lib/invoice";
import { getOverdueDays, formatOverdue, calcAvgCollectionDays } from "@/lib/date-utils";
import { buildReminderMessage, sendViaWati, openWhatsApp } from "@/lib/whatsapp";
import { getLastEscalationMap } from "@/lib/escalation";
import { logWhatsApp, fetchWhatsAppLog, fetchFollowUps, fetchRecordedPayments, type WhatsAppLogEntry, type FollowUp, type RecordedPayment } from "@/lib/api";
import { CreditCard, Search, User, ChevronRight, Phone, MessageCircle, Clock, CalendarClock, Loader2, Download, Timer, Filter, Send, ArrowDownWideNarrow, ArrowUpAZ, Star, Sparkles } from "lucide-react";
import { CustomerInsightDialog } from "@/components/CustomerInsightDialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExportMenu } from "@/components/ExportMenu";
import { useFocusCustomers } from "@/hooks/use-focus-customers";

interface InvoiceTableProps {
  invoices: Invoice[];
  onPaymentSuccess: () => void;
  exportTitle?: string;
  defaultSlowPayer?: boolean;
}

interface CustomerGroup {
  customerName: string;
  mobileNo: string;
  totalOutstanding: number;
  totalBill: number;
  totalPaid: number;
  invoiceCount: number;
  maxOverdueDays: number;
  avgCollectionDays: number | null;
  invoices: Invoice[];
}

function groupByCustomer(invoices: Invoice[], payments: RecordedPayment[]): CustomerGroup[] {
  const map = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (!map.has(inv.customerName)) map.set(inv.customerName, []);
    map.get(inv.customerName)!.push(inv);
  }
  return Array.from(map.entries())
    .map(([customerName, invs]) => {
      const custPayments = payments.filter(p => p.customerName === customerName);
      return {
        customerName,
        mobileNo: invs[0].mobileNo,
        totalOutstanding: invs.reduce((s, i) => s + i.outstandingAmount, 0),
        totalBill: invs.reduce((s, i) => s + i.billAmount, 0),
        totalPaid: invs.reduce((s, i) => s + i.paidAmount, 0),
        invoiceCount: invs.length,
        maxOverdueDays: Math.max(...invs.filter(i => i.outstandingAmount > 0).map(i => getOverdueDays(i.billDate)), 0),
        avgCollectionDays: calcAvgCollectionDays(invs, custPayments),
        invoices: sortInvoicesUnpaidFirst(invs),
      };
    })
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export function InvoiceTable({ invoices, onPaymentSuccess, exportTitle, defaultSlowPayer = false }: InvoiceTableProps) {
  const [search, setSearch] = useState("");
  const [slowPayerFilter, setSlowPayerFilter] = useState(defaultSlowPayer);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sendingWati, setSendingWati] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "outstanding">("name");
  const { toast } = useToast();
  const { isFocused, toggleFocus } = useFocusCustomers();
  const [insightCustomer, setInsightCustomer] = useState<string | null>(null);

  const { data: whatsAppLog = [] } = useQuery({
    queryKey: ["whatsapp-log"],
    queryFn: fetchWhatsAppLog,
  });

  const { data: allFollowUps = [] } = useQuery({
    queryKey: ["followups"],
    queryFn: fetchFollowUps,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["recorded-payments"],
    queryFn: fetchRecordedPayments,
  });

  const lastWhatsAppMap = useMemo(() => {
    const map = new Map<string, WhatsAppLogEntry>();
    for (const entry of whatsAppLog) {
      map.set(entry.customerName, entry);
    }
    return map;
  }, [whatsAppLog]);

  const lastEscalationMap = useMemo(() => getLastEscalationMap(whatsAppLog), [whatsAppLog]);

  // Latest pending follow-up per customer
  const latestFollowUpMap = useMemo(() => {
    const map = new Map<string, FollowUp>();
    for (const f of allFollowUps) {
      if (f.status === "Pending") {
        // Keep the last one (latest entry)
        map.set(f.customerName, f);
      }
    }
    return map;
  }, [allFollowUps]);

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.customerName.toLowerCase().includes(q) ||
        inv.billNo.toLowerCase().includes(q) ||
        inv.mobileNo.includes(search)
    );
  }, [invoices, search]);

  const customerGroups = useMemo(() => {
    let groups = groupByCustomer(filtered, allPayments);
    if (slowPayerFilter) groups = groups.filter(g => g.avgCollectionDays !== null && g.avgCollectionDays > 30);
    if (sortBy === "outstanding") {
      groups.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    }
    return groups;
  }, [filtered, allPayments, slowPayerFilter, sortBy]);
  const totalOutstanding = useMemo(() => filtered.reduce((s, i) => s + i.outstandingAmount, 0), [filtered]);
  const slowPayerCount = useMemo(() => {
    const groups = groupByCustomer(filtered, allPayments);
    return groups.filter(g => g.avgCollectionDays !== null && g.avgCollectionDays > 30).length;
  }, [filtered, allPayments]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1 min-w-[140px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer or bill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {slowPayerCount > 0 && (
          <Button
            variant={slowPayerFilter ? "default" : "outline"}
            size="sm"
            onClick={() => setSlowPayerFilter(!slowPayerFilter)}
            className="gap-1 text-[11px] sm:text-xs h-9 px-2 sm:px-3 shrink-0"
          >
            <Timer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Slow Payers</span>
            <span className="sm:hidden">Slow</span>
            <span className="bg-destructive/20 text-destructive text-[10px] font-bold px-1.5 py-0.5 rounded-full">{slowPayerCount}</span>
          </Button>
        )}
        <Button
          variant={sortBy === "outstanding" ? "default" : "outline"}
          size="sm"
          onClick={() => setSortBy(sortBy === "name" ? "outstanding" : "name")}
          className="gap-1 text-[11px] sm:text-xs h-9 px-2 sm:px-3 shrink-0"
        >
          {sortBy === "outstanding" ? <ArrowDownWideNarrow className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{sortBy === "outstanding" ? "By Amount" : "By Name"}</span>
          <span className="sm:hidden">{sortBy === "outstanding" ? "Amt↓" : "A-Z"}</span>
        </Button>
        <ExportMenu invoices={filtered} title={exportTitle || "All Customers"} payments={allPayments} />
        <div className="ml-auto text-right">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {customerGroups.length} customer{customerGroups.length !== 1 ? "s" : ""} · {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs sm:text-sm font-bold text-destructive">
            Outstanding: ₹{totalOutstanding.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {customerGroups.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center shadow-card">
          <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold mb-1">No customers found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {customerGroups.map((cg) => {
            const collectionPct = cg.totalBill > 0 ? Math.round((cg.totalPaid / cg.totalBill) * 100) : 0;
            const lastWA = lastWhatsAppMap.get(cg.customerName);
            const followUp = latestFollowUpMap.get(cg.customerName);
            const lastEscalation = lastEscalationMap.get(cg.customerName);
            const initials = cg.customerName.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Link
                key={cg.customerName}
                to={`/customer/${encodeURIComponent(cg.customerName)}`}
                className="block rounded-2xl border bg-card shadow-card hover:shadow-elevated hover:border-primary/30 hover:-translate-y-0.5 transition-all group overflow-hidden"
              >
                {/* Top row: avatar + name + outstanding */}
                <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5 sm:px-4 sm:pt-4">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFocus(cg.customerName); }}
                          className="shrink-0 p-1 -m-1 rounded-full hover:bg-warning/20 transition-colors"
                        >
                          <Star className={`h-3.5 w-3.5 ${isFocused(cg.customerName) ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                        </button>
                        <p className="text-base font-semibold font-display group-hover:text-primary transition-colors leading-snug break-words">
                          {cg.customerName}
                        </p>
                        {(() => {
                          const health = calculateHealthScore(cg.customerName, invoices, allPayments);
                          return <HealthBadge status={health.status} size="sm" showLabel={false} />;
                        })()}
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInsightCustomer(cg.customerName); }}
                          className="shrink-0 p-1 -m-1 rounded-full hover:bg-accent/20 transition-colors"
                          title="AI insight"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-accent" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg sm:text-xl font-bold font-display tabular-nums text-destructive leading-none">
                      ₹{cg.totalOutstanding.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      of ₹{cg.totalBill.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Collection progress bar */}
                <div className="px-3.5 sm:px-4 mt-2.5">
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-success to-success/70 transition-all"
                      style={{ width: `${collectionPct}%` }}
                    />
                  </div>
                </div>

                {/* Bottom row: meta info */}
                <div className="flex items-center gap-2 px-3.5 pb-3.5 pt-2.5 sm:px-4 sm:pb-4">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] text-muted-foreground flex-wrap flex-1">
                    <span className="inline-flex items-center gap-0.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      {cg.mobileNo}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{cg.invoiceCount} bill{cg.invoiceCount !== 1 ? "s" : ""}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-medium text-success">{collectionPct}% collected</span>
                    {cg.maxOverdueDays > 0 && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                        {formatOverdue(cg.maxOverdueDays)} overdue
                      </span>
                    )}
                    {cg.avgCollectionDays !== null && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">
                        <Timer className="h-3 w-3" />
                        {cg.avgCollectionDays}d avg
                      </span>
                    )}
                    {lastWA ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-success">
                        <MessageCircle className="h-3 w-3" />
                        {lastWA.timestamp}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                        <MessageCircle className="h-3 w-3" />
                        No WA
                      </span>
                    )}
                    {lastEscalation && (
                      <Badge variant="outline" className="text-[10px] border-warning/30 text-warning px-1.5 py-0">
                        📨 {lastEscalation}
                      </Badge>
                    )}
                  </div>

                  {cg.totalOutstanding > 0 && cg.mobileNo && (
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const msg = buildReminderMessage(cg.customerName, cg.invoices);
                        setSendingWati(cg.customerName);
                        try {
                          const result = await sendViaWati(cg.mobileNo, cg.customerName, cg.invoices);
                          if (result.success) {
                            await logWhatsApp(cg.customerName, cg.mobileNo);
                            toast({ title: "✅ WhatsApp sent via WATI", description: cg.customerName });
                          } else {
                            openWhatsApp(cg.mobileNo, msg);
                            toast({ title: "⚠️ WATI failed, opened WhatsApp", description: result.error, variant: "destructive" });
                          }
                        } catch {
                          openWhatsApp(cg.mobileNo, msg);
                          toast({ title: "⚠️ Fallback to WhatsApp link", variant: "destructive" });
                        } finally {
                          setSendingWati(null);
                        }
                      }}
                      disabled={sendingWati === cg.customerName}
                      className="p-2 rounded-xl bg-success/10 text-success hover:bg-success/20 transition-colors shrink-0 disabled:opacity-50"
                      title="Send WhatsApp via WATI"
                    >
                      {sendingWati === cg.customerName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Follow-up info */}
                {followUp && (
                  <div className="flex items-center gap-1.5 px-3.5 pb-3 sm:px-4 -mt-1 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      Follow-up: {followUp.nextFollowUpDate || followUp.followUpDate}
                    </span>
                    {followUp.remarks && (
                      <span className="text-muted-foreground truncate">— {followUp.remarks}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <PaymentDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={onPaymentSuccess}
      />
      <CustomerInsightDialog
        open={!!insightCustomer}
        onOpenChange={(o) => !o && setInsightCustomer(null)}
        customerName={insightCustomer || ""}
      />
    </>
  );
}
