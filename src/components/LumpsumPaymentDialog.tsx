import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/invoice";
import { recordBatchPayments, type PaymentAllocation } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const outstandingInvoices = useMemo(
    () => invoices.filter((inv) => inv.outstandingAmount > 0),
    [invoices]
  );

  const totalOutstanding = useMemo(
    () => outstandingInvoices.reduce((s, i) => s + i.outstandingAmount, 0),
    [outstandingInvoices]
  );

  const parsedLumpsum = parseFloat(lumpsumAmount) || 0;

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [allocations]);

  const remaining = parsedLumpsum - totalAllocated;
  const isFullyAllocated = parsedLumpsum > 0 && Math.abs(remaining) < 0.01;

  const setAllocation = (billNo: string, value: string) => {
    setAllocations((prev) => ({ ...prev, [billNo]: value }));
  };

  const autoAllocate = () => {
    if (parsedLumpsum <= 0) return;
    let left = parsedLumpsum;
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
    if (parsedLumpsum <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid lumpsum amount.", variant: "destructive" });
      return;
    }
    if (parsedLumpsum > totalOutstanding) {
      toast({ title: "Exceeds outstanding", description: `Max payable is ₹${totalOutstanding.toLocaleString("en-IN")}`, variant: "destructive" });
      return;
    }
    if (!isFullyAllocated) {
      toast({ title: "Allocation incomplete", description: "Allocate the full lumpsum amount to invoices before recording.", variant: "destructive" });
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
      await recordBatchPayments(paymentAllocations, format(paymentDate, "dd/MM/yyyy"));
      toast({
        title: "Lumpsum Payment Recorded",
        description: `₹${parsedLumpsum.toLocaleString("en-IN")} allocated across ${paymentAllocations.length} invoice(s)`,
      });
      setLumpsumAmount("");
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
          {/* Lumpsum input */}
          <div className="space-y-2">
            <Label>Total Lumpsum Amount (₹)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter total amount"
                value={lumpsumAmount}
                onChange={(e) => { setLumpsumAmount(e.target.value); setAllocations({}); }}
                min={0}
                max={totalOutstanding}
              />
              <Button variant="outline" size="sm" onClick={autoAllocate} disabled={parsedLumpsum <= 0} className="shrink-0">
                Auto Allocate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Total outstanding: ₹{totalOutstanding.toLocaleString("en-IN")}
            </p>
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
          {parsedLumpsum > 0 && (
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
          {parsedLumpsum > 0 && (
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
