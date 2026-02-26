import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!invoice) return;
    const paidAmount = parseFloat(amount);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid payment amount.", variant: "destructive" });
      return;
    }
    if (paidAmount > invoice.outstandingAmount) {
      toast({ title: "Amount exceeds outstanding", description: `Maximum payable amount is ₹${invoice.outstandingAmount.toLocaleString("en-IN")}`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await recordPayment(invoice.billNo, invoice.customerName, paidAmount, format(paymentDate, "dd/MM/yyyy"));
      toast({ title: "Payment Recorded", description: `₹${paidAmount.toLocaleString("en-IN")} recorded for ${invoice.customerName}` });
      setAmount("");
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
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              max={invoice.outstandingAmount}
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
