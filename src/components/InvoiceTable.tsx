import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentDialog } from "@/components/PaymentDialog";
import { Link } from "react-router-dom";
import type { Invoice } from "@/lib/invoice";
import { getOverdueDays, formatOverdue } from "@/lib/date-utils";
import { buildReminderMessage, openWhatsApp } from "@/lib/whatsapp";
import { CreditCard, Search, User, ChevronRight, Phone, MessageCircle } from "lucide-react";

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
      maxOverdueDays: Math.max(...invs.filter(i => i.outstandingAmount > 0).map(i => getOverdueDays(i.dueDate)), 0),
      invoices: invs,
    }))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

export function InvoiceTable({ invoices, onPaymentSuccess }: InvoiceTableProps) {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
        <div className="space-y-1.5">
          {customerGroups.map((cg) => {
            const collectionPct = cg.totalBill > 0 ? Math.round((cg.totalPaid / cg.totalBill) * 100) : 0;
            return (
              <Link
                key={cg.customerName}
                to={`/customer/${encodeURIComponent(cg.customerName)}`}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors group"
              >
                <div className="p-2 rounded-full bg-primary/10 shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {cg.customerName}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Phone className="h-3 w-3" />
                      {cg.mobileNo}
                    </span>
                    <span>·</span>
                    <span>{cg.invoiceCount} bill{cg.invoiceCount !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{collectionPct}% collected</span>
                  </div>
                </div>

                {cg.maxOverdueDays > 0 && (
                  <span className="text-[11px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full shrink-0">
                    {formatOverdue(cg.maxOverdueDays)} overdue
                  </span>
                )}

                {cg.totalOutstanding > 0 && cg.mobileNo && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const msg = buildReminderMessage(cg.customerName, cg.invoices);
                      openWhatsApp(cg.mobileNo, msg);
                    }}
                    className="p-1.5 rounded-full text-green-600 hover:bg-green-100 transition-colors shrink-0"
                    title="Send WhatsApp reminder"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                )}

                <div className="text-right shrink-0 min-w-[90px]">
                  <p className="text-sm font-bold text-destructive">
                    ₹{cg.totalOutstanding.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    of ₹{cg.totalBill.toLocaleString("en-IN")}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
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
