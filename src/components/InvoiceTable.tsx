import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentDialog } from "@/components/PaymentDialog";
import type { Invoice } from "@/lib/invoice";
import { CreditCard, Search } from "lucide-react";

interface InvoiceTableProps {
  invoices: Invoice[];
  onPaymentSuccess: () => void;
}

export function InvoiceTable({ invoices, onPaymentSuccess }: InvoiceTableProps) {
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = invoices.filter(
    (inv) =>
      inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
      inv.billNo.toLowerCase().includes(search.toLowerCase()) ||
      inv.mobileNo.includes(search)
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, bill no, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Bill No</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Mobile</TableHead>
                <TableHead className="font-semibold text-right">Bill Amt</TableHead>
                <TableHead className="font-semibold text-right">Paid</TableHead>
                <TableHead className="font-semibold text-right">Outstanding</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => (
                  <TableRow key={inv.billNo} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs">{inv.billNo}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {inv.customerName}
                    </TableCell>
                    <TableCell className="text-sm">{inv.mobileNo}</TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{inv.billAmount.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      ₹{inv.paidAmount.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-semibold">
                      ₹{inv.outstandingAmount.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-sm">{inv.dueDate}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.paymentStatus} />
                    </TableCell>
                    <TableCell className="text-center">
                      {inv.outstandingAmount > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setDialogOpen(true);
                          }}
                          className="gap-1.5"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Collect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
