import { useState } from "react";
import { format } from "date-fns";
import { useUser } from "@/contexts/UserContext";
import { CalendarIcon, Banknote, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/invoice";
import { recordPayment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface PaymentDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentDialog({ invoice, open, onClose, onSuccess }: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Online">("Cash");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useUser();

  const parsedAmount = parseFloat(amount) || 0;
  const parsedDiscount = parseFloat(discount) || 0;
  const totalSettled = parsedAmount + parsedDiscount;

  const handleSubmit = async () => {
    if (!invoice) return;
    if (parsedAmount <= 0 && parsedDiscount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid payment amount or discount.", variant: "destructive" });
      return;
    }
    if (parsedAmount < 0 || parsedDiscount < 0) {
      toast({ title: "Invalid values", description: "Amount and discount cannot be negative.", variant: "destructive" });
      return;
    }
    if (totalSettled > invoice.outstandingAmount) {
      toast({ title: "Exceeds outstanding", description: `Amount + Discount (₹${totalSettled.toLocaleString("en-IN")}) exceeds outstanding ₹${invoice.outstandingAmount.toLocaleString("en-IN")}`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await recordPayment(invoice.billNo, invoice.customerName, parsedAmount, format(paymentDate, "dd/MM/yyyy"), paymentMode, parsedDiscount, notes.trim() || undefined, currentUser || undefined);
      toast({ title: "Payment Recorded", description: `₹${parsedAmount.toLocaleString("en-IN")} received${parsedDiscount > 0 ? ` + ₹${parsedDiscount.toLocaleString("en-IN")} discount` : ""} for ${invoice.customerName}` });
      setAmount("");
      setDiscount("");
      setNotes("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-['Space_Grotesk']">Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Bill No</p>
              <p className="font-medium">{invoice.billNo}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Bill Amount</p>
              <p className="font-medium">₹{invoice.billAmount.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Outstanding</p>
              <p className="font-medium text-destructive">
                ₹{invoice.outstandingAmount.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Payment Mode */}
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={paymentMode === "Cash" ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => setPaymentMode("Cash")}
              >
                <Banknote className="h-4 w-4" />
                Cash
              </Button>
              <Button
                type="button"
                variant={paymentMode === "Online" ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => setPaymentMode("Online")}
              >
                <Smartphone className="h-4 w-4" />
                Online
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount Received (₹)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount received"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              max={invoice.outstandingAmount}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount">Discount (₹)</Label>
            <Input
              id="discount"
              type="number"
              placeholder="Enter discount (if any)"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              min={0}
            />
          </div>

          {/* Total settled summary */}
          {(parsedAmount > 0 || parsedDiscount > 0) && (
            <div className="rounded-lg p-3 text-sm bg-muted/50 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Received</span>
                <span>₹{parsedAmount.toLocaleString("en-IN")}</span>
              </div>
              {parsedDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>₹{parsedDiscount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t pt-1 border-border">
                <span>Total Settled</span>
                <span className={totalSettled > invoice.outstandingAmount ? "text-destructive" : ""}>
                  ₹{totalSettled.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(paymentDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(d) => d && setPaymentDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
