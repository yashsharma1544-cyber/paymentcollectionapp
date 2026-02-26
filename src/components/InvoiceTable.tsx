import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentDialog } from "@/components/PaymentDialog";
import { Link } from "react-router-dom";
import type { Invoice } from "@/lib/invoice";
import { sortInvoicesUnpaidFirst } from "@/lib/invoice";
import { getOverdueDays, formatOverdue } from "@/lib/date-utils";
import { buildReminderMessage, sendViaWati, openWhatsApp } from "@/lib/whatsapp";
import { logWhatsApp, fetchWhatsAppLog, fetchFollowUps, type WhatsAppLogEntry, type FollowUp } from "@/lib/api";
import { CreditCard, Search, User, ChevronRight, Phone, MessageCircle, Clock, CalendarClock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoiceTableProps {
  invoices: Invoice[];
  onPaymentSuccess: () => void;
}

interface CustomerGroup {
  customerName: string;
  mobileNo: string;
  totalOutstanding: number;
  totalBill: number;
  totalPaid: number;
  invoiceCount: number;
  maxOverdueDays: number;
  invoices: Invoice[];
}

function groupByCustomer(invoices: Invoice[]): CustomerGroup[] {
  const map = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (!map.has(inv.customerName)) map.set(inv.customerName, []);
    map.get(inv.customerName)!.push(inv);
  }
  return Array.from(map.entries())
    .map(([customerName, invs]) => ({
      customerName,
      mobileNo: invs[0].mobileNo,
      totalOutstanding: invs.reduce((s, i) => s + i.outstandingAmount, 0),
      totalBill: invs.reduce((s, i) => s + i.billAmount, 0),
      totalPaid: invs.reduce((s, i) => s + i.paidAmount, 0),
      invoiceCount: invs.length,
      maxOverdueDays: Math.max(...invs.filter(i => i.outstandingAmount > 0).map(i => getOverdueDays(i.billDate)), 0),
      invoices: sortInvoicesUnpaidFirst(invs),
    }))
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export function InvoiceTable({ invoices, onPaymentSuccess }: InvoiceTableProps) {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sendingWati, setSendingWati] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: whatsAppLog = [] } = useQuery({
    queryKey: ["whatsapp-log"],
    queryFn: fetchWhatsAppLog,
  });

  const { data: allFollowUps = [] } = useQuery({
    queryKey: ["followups"],
    queryFn: fetchFollowUps,
  });

  const lastWhatsAppMap = useMemo(() => {
    const map = new Map<string, WhatsAppLogEntry>();
    for (const entry of whatsAppLog) {
      map.set(entry.customerName, entry);
    }
    return map;
  }, [whatsAppLog]);

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

  const customerGroups = useMemo(() => groupByCustomer(filtered), [filtered]);
  const totalOutstanding = useMemo(() => filtered.reduce((s, i) => s + i.outstandingAmount, 0), [filtered]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer or bill no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">
            {customerGroups.length} customer{customerGroups.length !== 1 ? "s" : ""} · {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm font-bold text-destructive">
            Outstanding: ₹{totalOutstanding.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {customerGroups.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          No invoices found
        </div>
      ) : (
        <div className="space-y-2">
          {customerGroups.map((cg) => {
            const collectionPct = cg.totalBill > 0 ? Math.round((cg.totalPaid / cg.totalBill) * 100) : 0;
            const lastWA = lastWhatsAppMap.get(cg.customerName);
            const followUp = latestFollowUpMap.get(cg.customerName);
            return (
              <Link
                key={cg.customerName}
                to={`/customer/${encodeURIComponent(cg.customerName)}`}
                className="block rounded-lg border bg-card hover:bg-muted/40 transition-colors group"
              >
                {/* Top row: name + outstanding */}
                <div className="flex items-start justify-between gap-2 px-3 pt-2.5 sm:px-4 sm:pt-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="p-1.5 rounded-full bg-primary/10 shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <p className="text-base font-semibold group-hover:text-primary transition-colors leading-snug break-words">
                      {cg.customerName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-destructive">
                      ₹{cg.totalOutstanding.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      of ₹{cg.totalBill.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Bottom row: meta info */}
                <div className="flex items-center gap-2 px-3 pb-2.5 pt-1.5 sm:px-4 sm:pb-3">
                  <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-muted-foreground flex-wrap flex-1">
                    <span className="flex items-center gap-0.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      {cg.mobileNo}
                    </span>
                    <span>{cg.invoiceCount} bill{cg.invoiceCount !== 1 ? "s" : ""}</span>
                    <span>{collectionPct}% collected</span>
                    {cg.maxOverdueDays > 0 && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                        {formatOverdue(cg.maxOverdueDays)} overdue
                      </span>
                    )}
                    {lastWA ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                        <MessageCircle className="h-3 w-3" />
                        {lastWA.timestamp}
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                        <MessageCircle className="h-3 w-3" />
                        No WA
                      </span>
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
                            // Fallback to wa.me link
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
                      className="p-1.5 rounded-full text-green-600 hover:bg-green-100 transition-colors shrink-0 disabled:opacity-50"
                      title="Send WhatsApp via WATI"
                    >
                      {sendingWati === cg.customerName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>

                {/* Follow-up info */}
                {followUp && (
                  <div className="flex items-center gap-1.5 px-3 pb-2 sm:px-4 text-[10px]">
                    <CalendarClock className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-primary font-medium">
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
    </>
  );
}
