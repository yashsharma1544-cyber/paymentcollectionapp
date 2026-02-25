import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentDialog } from "@/components/PaymentDialog";
import { Card } from "@/components/ui/card";
import type { Invoice } from "@/lib/invoice";
import { CreditCard, Search, ChevronRight, ChevronDown, User } from "lucide-react";

interface InvoiceTableProps {
  invoices: Invoice[];
  onPaymentSuccess: () => void;
}

interface CustomerGroup {
  customerName: string;
  mobileNo: string;
  totalOutstanding: number;
  totalBill: number;
  invoiceCount: number;
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
      invoiceCount: invs.length,
      invoices: invs,
    }))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

export function InvoiceTable({ invoices, onPaymentSuccess }: InvoiceTableProps) {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

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

  const toggleCustomer = (name: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

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
          <p className="text-sm font-bold text-destructive font-['Space_Grotesk']">
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
            const isExpanded = expandedCustomers.has(cg.customerName);
            return (
              <Card key={cg.customerName} className="border shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleCustomer(cg.customerName)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{cg.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {cg.invoiceCount} bill{cg.invoiceCount !== 1 ? "s" : ""} · {cg.mobileNo}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-destructive">
                      ₹{cg.totalOutstanding.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      of ₹{cg.totalBill.toLocaleString("en-IN")}
                    </p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t overflow-x-auto bg-muted/10">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs font-semibold">Bill No</TableHead>
                          <TableHead className="text-xs font-semibold">Date</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Bill Amt</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
                          <TableHead className="text-xs font-semibold">Due</TableHead>
                          <TableHead className="text-xs font-semibold">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cg.invoices.map((inv) => (
                          <TableRow key={inv.billNo} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-mono text-xs">{inv.billNo}</TableCell>
                            <TableCell className="text-xs">{inv.billDate}</TableCell>
                            <TableCell className="text-right text-xs font-medium">
                              ₹{inv.billAmount.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="text-right text-xs text-success font-medium">
                              ₹{inv.paidAmount.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="text-right text-xs text-destructive font-semibold">
                              ₹{inv.outstandingAmount.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="text-xs">{inv.dueDate}</TableCell>
                            <TableCell>
                              <StatusBadge status={inv.paymentStatus} />
                            </TableCell>
                            <TableCell className="text-center">
                              {inv.outstandingAmount > 0 && (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInvoice(inv);
                                    setDialogOpen(true);
                                  }}
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
                )}
              </Card>
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
