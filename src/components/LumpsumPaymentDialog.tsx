import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useUser } from "@/contexts/UserContext";
import { CalendarIcon, Banknote, Smartphone } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/invoice";
import { recordBatchPayments, type PaymentAllocation } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { MiniCalculator } from "@/components/MiniCalculator";

interface LumpsumPaymentDialogProps {
  invoices: Invoice[];
  customerName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LumpsumPaymentDialog({
  invoices,
  customerName,
  open,
  onClose,
  onSuccess,
}: LumpsumPaymentDialogProps) {
  const [lumpsumAmount, setLumpsumAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Online">("Cash");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useUser();

  const outstandingInvoices = useMemo(
    () =>
      invoices
        .filter((inv) => inv.outstandingAmount > 0)
        .sort((a, b) => {
          // Sort oldest invoice first by bill date
          const dateA = a.billDate ? new Date(a.billDate.split("/").reverse().join("-")).getTime() : 0;
          const dateB = b.billDate ? new Date(b.billDate.split("/").reverse().join("-")).getTime() : 0;
          return dateA - dateB || a.billNo.localeCompare(b.billNo);
        }),
    [invoices]
  );

  const totalOutstanding = useMemo(
    () => outstandingInvoices.reduce((s, i) => s + i.outstandingAmount, 0),
    [outstandingInvoices]
  );

  const parsedLumpsum = parseFloat(lumpsumAmount) || 0;
  const parsedDiscount = parseFloat(discount) || 0;
  const totalSettled = parsedLumpsum + parsedDiscount;

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [allocations]);

  // Allocation should match total settled (amount + discount)
  const remaining = totalSettled - totalAllocated;
  const isFullyAllocated = totalSettled > 0 && Math.abs(remaining) < 0.01;

  const setAllocation = (billNo: string, value: string) => {
    setAllocations((prev) => ({ ...prev, [billNo]: value }));
  };

  const autoAllocate = () => {
    if (totalSettled <= 0) return;
    let left = totalSettled;
    const newAllocations: Record<string, string> = {};
    for (const inv of outstandingInvoices) {
      if (left <= 0) break;
      const alloc = Math.min(left, inv.outstandingAmount);
      newAllocations[inv.billNo] = alloc.toString();
      left -= alloc;
    }
    setAllocations(newAllocations);
  };

  const handleSubmit = async () => {
    if (parsedLumpsum <= 0 && parsedDiscount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid amount or discount.", variant: "destructive" });
      return;
    }
    if (totalSettled > totalOutstanding) {
      toast({ title: "Exceeds outstanding", description: `Amount + Discount (₹${totalSettled.toLocaleString("en-IN")}) exceeds total outstanding ₹${totalOutstanding.toLocaleString("en-IN")}`, variant: "destructive" });
      return;
    }
    if (!isFullyAllocated) {
      toast({ title: "Allocation incomplete", description: "Allocate the full amount (received + discount) to invoices before recording.", variant: "destructive" });
      return;
    }

    // Validate individual allocations
    const paymentAllocations: PaymentAllocation[] = [];
    for (const inv of outstandingInvoices) {
      const amt = parseFloat(allocations[inv.billNo] || "0");
      if (amt < 0) {
        toast({ title: "Invalid allocation", description: `Negative amount for ${inv.billNo}`, variant: "destructive" });
        return;
      }
      if (amt > inv.outstandingAmount) {
        toast({ title: "Exceeds outstanding", description: `₹${amt} exceeds outstanding ₹${inv.outstandingAmount.toLocaleString("en-IN")} for ${inv.billNo}`, variant: "destructive" });
        return;
      }
      if (amt > 0) {
        paymentAllocations.push({ billNo: inv.billNo, customerName, paidAmount: amt });
      }
    }

    if (paymentAllocations.length === 0) {
      toast({ title: "No allocations", description: "Allocate amounts to at least one invoice.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await recordBatchPayments(paymentAllocations, format(paymentDate, "dd/MM/yyyy"), paymentMode, parsedDiscount, notes.trim() || undefined, currentUser || undefined);
      toast({
        title: "Lumpsum Payment Recorded",
        description: `₹${parsedLumpsum.toLocaleString("en-IN")} received${parsedDiscount > 0 ? ` + ₹${parsedDiscount.toLocaleString("en-IN")} discount` : ""} across ${paymentAllocations.length} invoice(s)`,
      });
      setLumpsumAmount("");
      setDiscount("");
      setNotes("");
      setAllocations({});
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLumpsumAmount("");
    setDiscount("");
    setNotes("");
    setAllocations({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lumpsum Payment — {customerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Total Outstanding Banner */}
          <div className="rounded-xl p-4 bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total Outstanding</p>
                <p className="text-2xl font-bold text-destructive mt-1">
                  ₹{totalOutstanding.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Across</p>
                <p className="text-sm font-semibold">{outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? "s" : ""}</p>
              </div>
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

          {/* Amount + Discount inputs */}
          <div className="space-y-2">
            <Label>Amount Received (₹)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Enter amount received"
                value={lumpsumAmount}
                onChange={(e) => { setLumpsumAmount(e.target.value); setAllocations({}); }}
                min={0}
                max={totalOutstanding}
                className="min-w-0 flex-1"
              />
              <MiniCalculator onApply={(v) => { setLumpsumAmount(String(v)); setAllocations({}); }} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Discount (₹)</Label>
            <Input
              type="number"
              placeholder="Enter discount (if any)"
              value={discount}
              onChange={(e) => { setDiscount(e.target.value); setAllocations({}); }}
              min={0}
            />
          </div>

          {/* Total summary */}
          {(parsedLumpsum > 0 || parsedDiscount > 0) && (
            <div className="rounded-lg p-3 text-sm bg-muted/50 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Received</span>
                <span>₹{parsedLumpsum.toLocaleString("en-IN")}</span>
              </div>
              {parsedDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>₹{parsedDiscount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t pt-1 border-border">
                <span>Total to Allocate</span>
                <span className={totalSettled > totalOutstanding ? "text-destructive" : ""}>
                  ₹{totalSettled.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Total outstanding: ₹{totalOutstanding.toLocaleString("en-IN")}
              </p>
            </div>
          )}

          {/* Auto Allocate */}
          {totalSettled > 0 && (
            <Button variant="outline" size="sm" onClick={autoAllocate} className="w-full">
              Auto Allocate
            </Button>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add any notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>

          {/* Payment Date */}
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

          {/* Allocation status */}
          {totalSettled > 0 && (
            <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${isFullyAllocated ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
              {isFullyAllocated ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>
                Allocated: ₹{totalAllocated.toLocaleString("en-IN")}
                {!isFullyAllocated && ` — Remaining: ₹${remaining.toLocaleString("en-IN")}`}
              </span>
            </div>
          )}

          {/* Invoice allocation list */}
          {totalSettled > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Allocate to Invoices</Label>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {outstandingInvoices.map((inv) => {
                  const alloc = parseFloat(allocations[inv.billNo] || "0");
                  const exceeds = alloc > inv.outstandingAmount;
                  return (
                    <div key={inv.billNo} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-medium">{inv.billNo}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Outstanding: ₹{inv.outstandingAmount.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <Input
                        type="number"
                        placeholder="0"
                        value={allocations[inv.billNo] || ""}
                        onChange={(e) => setAllocation(inv.billNo, e.target.value)}
                        min={0}
                        max={inv.outstandingAmount}
                        className={`w-28 text-right text-sm ${exceeds ? "border-destructive" : ""}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isFullyAllocated}>
            {loading ? "Recording..." : "Record Lumpsum Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
