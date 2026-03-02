import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, RefreshCw } from "lucide-react";
import type { Invoice } from "@/lib/invoice";
import { getOverdueDays, formatOverdue } from "@/lib/date-utils";

interface WhatsAppInvoiceSelectorProps {
  open: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onSend: (selectedInvoices: Invoice[]) => Promise<void>;
  sending: boolean;
}

export function WhatsAppInvoiceSelector({ open, onClose, invoices, onSend, sending }: WhatsAppInvoiceSelectorProps) {
  const outstanding = useMemo(() => invoices.filter((i) => i.outstandingAmount > 0), [invoices]);
  const oldest10 = useMemo(() => {
    return [...outstanding]
      .sort((a, b) => getOverdueDays(b.billDate) - getOverdueDays(a.billDate))
      .slice(0, 8);
  }, [outstanding]);
  const [selected, setSelected] = useState<Set<string>>(new Set(oldest10.map((i) => i.billNo)));

  // Reset selection when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const top10 = [...outstanding]
        .sort((a, b) => getOverdueDays(b.billDate) - getOverdueDays(a.billDate))
        .slice(0, 8);
      setSelected(new Set(top10.map((i) => i.billNo)));
    } else {
      onClose();
    }
  };

  const toggleAll = () => {
    if (selected.size === outstanding.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(outstanding.map((i) => i.billNo)));
    }
  };

  const toggle = (billNo: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(billNo)) next.delete(billNo);
      else next.add(billNo);
      return next;
    });
  };

  const selectedInvoices = outstanding.filter((i) => selected.has(i.billNo));
  const selectedTotal = selectedInvoices.reduce((s, i) => s + i.outstandingAmount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Select Invoices for Reminder
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <Checkbox
              checked={selected.size === outstanding.length && outstanding.length > 0}
              onCheckedChange={toggleAll}
            />
            Select All ({outstanding.length})
          </label>
          <span className="text-xs text-muted-foreground">
            {selected.size} selected
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 py-2">
          {outstanding.map((inv) => {
            const overdue = getOverdueDays(inv.billDate);
            return (
              <label
                key={inv.billNo}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selected.has(inv.billNo)}
                  onCheckedChange={() => toggle(inv.billNo)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-mono font-medium">{inv.billNo}</span>
                    <span className="text-sm font-bold text-destructive">
                      ₹{inv.outstandingAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span>{inv.billDate}</span>
                    {overdue > 0 && (
                      <span className="text-destructive font-semibold">
                        {formatOverdue(overdue)} overdue
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
          {outstanding.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">No outstanding invoices</p>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Total Selected</span>
            <span className="text-base font-bold text-destructive">
              ₹{selectedTotal.toLocaleString("en-IN")}
            </span>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={() => onSend(selectedInvoices)}
              disabled={selected.size === 0 || sending}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {sending ? "Sending..." : `Send (${selected.size})`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
