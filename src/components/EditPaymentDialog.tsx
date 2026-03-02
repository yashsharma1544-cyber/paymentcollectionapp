import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { editPayment, type RecordedPayment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface EditPaymentDialogProps {
  payment: RecordedPayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditPaymentDialog({ payment, open, onOpenChange, onSuccess }: EditPaymentDialogProps) {
  const { toast } = useToast();
  const { currentUser } = useUser();
  const [saving, setSaving] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");

  // Sync state when payment changes
  const resetForm = (p: RecordedPayment) => {
    setPaidAmount(p.paidAmount.toString());
    setPaymentDate(p.paymentDate || "");
    setPaymentMode(p.paymentMode || "Cash");
    setDiscount(p.discount > 0 ? p.discount.toString() : "");
    setNotes(p.notes || "");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && payment) resetForm(payment);
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!payment) return;
    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await editPayment({
        billNo: payment.billNo,
        originalTimestamp: payment.timestamp,
        customerName: payment.customerName,
        paidAmount: amount,
        paymentDate,
        paymentMode,
        discount: parseFloat(discount) || 0,
        notes,
        collectedBy: currentUser || undefined,
      });
      toast({ title: "✅ Payment updated successfully" });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast({ title: "Failed to update payment", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Payment — {payment?.billNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Customer</Label>
            <Input value={payment?.customerName || ""} disabled className="text-sm bg-muted/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Paid Amount (₹)</Label>
            <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Discount (₹)</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="text-sm" placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[60px]" placeholder="Optional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
