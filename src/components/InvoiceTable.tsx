import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentDialog } from "@/components/PaymentDialog";
import type { Invoice } from "@/lib/invoice";
import { CreditCard, Search, ChevronRight, ChevronDown, MapPin, User } from "lucide-react";

interface InvoiceTableProps {
  invoices: Invoice[];
  onPaymentSuccess: () => void;
}

interface BeatGroup {
  beat: string;
  totalOutstanding: number;
  customers: CustomerGroup[];
}

interface CustomerGroup {
  customerName: string;
  totalOutstanding: number;
  invoices: Invoice[];
}

function groupByBeatAndCustomer(invoices: Invoice[]): BeatGroup[] {
  const beatMap = new Map<string, Map<string, Invoice[]>>();

  for (const inv of invoices) {
    if (!beatMap.has(inv.beat)) beatMap.set(inv.beat, new Map());
    const customerMap = beatMap.get(inv.beat)!;
    if (!customerMap.has(inv.customerName)) customerMap.set(inv.customerName, []);
    customerMap.get(inv.customerName)!.push(inv);
  }

  return Array.from(beatMap.entries())
    .map(([beat, customerMap]) => {
      const customers: CustomerGroup[] = Array.from(customerMap.entries()).map(
        ([customerName, invoices]) => ({
          customerName,
          totalOutstanding: invoices.reduce((s, i) => s + i.outstandingAmount, 0),
          invoices,
        })
      );
      return {
        beat,
        totalOutstanding: customers.reduce((s, c) => s + c.totalOutstanding, 0),
        customers,
      };
    })
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

export function InvoiceTable({ invoices, onPaymentSuccess }: InvoiceTableProps) {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedBeats, setExpandedBeats] = useState<Set<string>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.customerName.toLowerCase().includes(q) ||
        inv.billNo.toLowerCase().includes(q) ||
        inv.mobileNo.includes(search) ||
        inv.beat.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const beatGroups = useMemo(() => groupByBeatAndCustomer(filtered), [filtered]);

  const toggleBeat = (beat: string) => {
    setExpandedBeats((prev) => {
      const next = new Set(prev);
      next.has(beat) ? next.delete(beat) : next.add(beat);
      return next;
    });
  };

  const toggleCustomer = (key: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, bill no, mobile, or beat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""} · {beatGroups.length} beat{beatGroups.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {beatGroups.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
            No invoices found
          </div>
        ) : (
          beatGroups.map((beatGroup) => {
            const isBeatExpanded = expandedBeats.has(beatGroup.beat);
            return (
              <div key={beatGroup.beat} className="rounded-xl border bg-card overflow-hidden">
                {/* Beat Header */}
                <button
                  onClick={() => toggleBeat(beatGroup.beat)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                >
                  {isBeatExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold font-['Space_Grotesk'] text-sm">
                      {beatGroup.beat}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {beatGroup.customers.length} customer{beatGroup.customers.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-destructive whitespace-nowrap">
                    ₹{beatGroup.totalOutstanding.toLocaleString("en-IN")}
                  </span>
                </button>

                {/* Customers within Beat */}
                {isBeatExpanded && (
                  <div className="border-t">
                    {beatGroup.customers.map((cg) => {
                      const customerKey = `${beatGroup.beat}::${cg.customerName}`;
                      const isCustomerExpanded = expandedCustomers.has(customerKey);
                      return (
                        <div key={customerKey} className="border-b last:border-b-0">
                          {/* Customer Header */}
                          <button
                            onClick={() => toggleCustomer(customerKey)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-muted/30 transition-colors text-left"
                          >
                            {isCustomerExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <div className="p-1 rounded-md bg-accent/10">
                              <User className="h-3.5 w-3.5 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm">{cg.customerName}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {cg.invoices.length} invoice{cg.invoices.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-destructive whitespace-nowrap">
                              ₹{cg.totalOutstanding.toLocaleString("en-IN")}
                            </span>
                          </button>

                          {/* Invoice Details */}
                          {isCustomerExpanded && (
                            <div className="overflow-x-auto bg-muted/20">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/40">
                                    <TableHead className="font-semibold text-xs pl-16">Bill No</TableHead>
                                    <TableHead className="font-semibold text-xs">Mobile</TableHead>
                                    <TableHead className="font-semibold text-xs text-right">Bill Amt</TableHead>
                                    <TableHead className="font-semibold text-xs text-right">Paid</TableHead>
                                    <TableHead className="font-semibold text-xs text-right">Outstanding</TableHead>
                                    <TableHead className="font-semibold text-xs">Due Date</TableHead>
                                    <TableHead className="font-semibold text-xs">Status</TableHead>
                                    <TableHead className="font-semibold text-xs text-center">Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cg.invoices.map((inv) => (
                                    <TableRow key={inv.billNo} className="hover:bg-muted/30 transition-colors">
                                      <TableCell className="font-mono text-xs pl-16">{inv.billNo}</TableCell>
                                      <TableCell className="text-xs">{inv.mobileNo}</TableCell>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
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
