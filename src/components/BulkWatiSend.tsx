import { useState, useMemo } from "react";
import type { Invoice } from "@/lib/invoice";
import { buildReminderMessage, sendViaWati } from "@/lib/whatsapp";
import { logWhatsApp } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, Send, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerForBulk {
  customerName: string;
  mobileNo: string;
  totalOutstanding: number;
  invoices: Invoice[];
}

interface BulkWatiSendProps {
  invoices: Invoice[];
}

type SendStatus = "pending" | "sending" | "sent" | "failed";

interface BulkEntry {
  customer: CustomerForBulk;
  selected: boolean;
  status: SendStatus;
  error?: string;
}

export function BulkWatiSend({ invoices }: BulkWatiSendProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const customers = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      if (inv.outstandingAmount <= 0) continue;
      if (!map.has(inv.customerName)) map.set(inv.customerName, []);
      map.get(inv.customerName)!.push(inv);
    }
    return Array.from(map.entries())
      .map(([name, invs]) => ({
        customerName: name,
        mobileNo: invs[0].mobileNo,
        totalOutstanding: invs.reduce((s, i) => s + i.outstandingAmount, 0),
        invoices: invs,
      }))
      .filter((c) => c.mobileNo && !c.mobileNo.startsWith("1111"))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [invoices]);

  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [sending, setSending] = useState(false);

  const handleOpen = () => {
    setEntries(customers.map((c) => ({ customer: c, selected: true, status: "pending" })));
    setOpen(true);
  };

  const toggleAll = (checked: boolean) => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected: checked })));
  };

  const toggleOne = (index: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e))
    );
  };

  const selectedCount = entries.filter((e) => e.selected).length;
  const sentCount = entries.filter((e) => e.status === "sent").length;
  const failedCount = entries.filter((e) => e.status === "failed").length;

  const handleSendAll = async () => {
    setSending(true);
    const toSend = entries.filter((e) => e.selected && e.status === "pending");

    for (let i = 0; i < toSend.length; i++) {
      const entry = toSend[i];
      const entryIndex = entries.findIndex((e) => e.customer.customerName === entry.customer.customerName);

      setEntries((prev) =>
        prev.map((e, idx) => (idx === entryIndex ? { ...e, status: "sending" } : e))
      );

      try {
        const msg = buildReminderMessage(entry.customer.customerName, entry.customer.invoices);
        const result = await sendViaWati(entry.customer.mobileNo, msg);

        if (result.success) {
          await logWhatsApp(entry.customer.customerName, entry.customer.mobileNo);
          setEntries((prev) =>
            prev.map((e, idx) => (idx === entryIndex ? { ...e, status: "sent" } : e))
          );
        } else {
          setEntries((prev) =>
            prev.map((e, idx) => (idx === entryIndex ? { ...e, status: "failed", error: result.error } : e))
          );
        }
      } catch (err) {
        setEntries((prev) =>
          prev.map((e, idx) => (idx === entryIndex ? { ...e, status: "failed", error: "Network error" } : e))
        );
      }

      // Stagger requests (500ms delay between each)
      if (i < toSend.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setSending(false);
    toast({
      title: "Bulk send complete",
      description: `Sent: ${entries.filter((e) => e.status === "sent").length}, Failed: ${entries.filter((e) => e.status === "failed").length}`,
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs text-green-600 border-green-600 hover:bg-green-50" onClick={handleOpen}>
        <MessageCircle className="h-3.5 w-3.5" />
        Bulk WhatsApp
      </Button>

      <Dialog open={open} onOpenChange={(v) => !sending && setOpen(v)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Bulk WhatsApp Send via WATI
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedCount === entries.length && entries.length > 0}
                onCheckedChange={(c) => toggleAll(!!c)}
                disabled={sending}
              />
              <span className="text-xs text-muted-foreground">
                {selectedCount} of {entries.length} selected
              </span>
            </div>
            {(sentCount > 0 || failedCount > 0) && (
              <div className="flex items-center gap-2 text-xs">
                {sentCount > 0 && <span className="text-green-600">✓ {sentCount} sent</span>}
                {failedCount > 0 && <span className="text-destructive">✕ {failedCount} failed</span>}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 py-2 max-h-[50vh]">
            {entries.map((entry, i) => (
              <div
                key={entry.customer.customerName}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                  entry.status === "sent" ? "bg-green-50 border-green-200" :
                  entry.status === "failed" ? "bg-destructive/5 border-destructive/20" :
                  entry.status === "sending" ? "bg-primary/5 border-primary/20" :
                  "bg-card"
                }`}
              >
                <Checkbox
                  checked={entry.selected}
                  onCheckedChange={() => toggleOne(i)}
                  disabled={sending || entry.status !== "pending"}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{entry.customer.customerName}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.customer.mobileNo} · ₹{entry.customer.totalOutstanding.toLocaleString("en-IN")}</p>
                </div>
                <div className="shrink-0">
                  {entry.status === "sending" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {entry.status === "sent" && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {entry.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              {sending ? "Sending..." : "Close"}
            </Button>
            <Button
              onClick={handleSendAll}
              disabled={sending || selectedCount === 0}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4" /> Send to {selectedCount} customers</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
