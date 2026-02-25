import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addFollowUp } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface FollowUpDialogProps {
  customerName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: string;
  allowCustomerNameEdit?: boolean;
}

export function FollowUpDialog({ customerName, open, onClose, onSuccess, defaultType = "Manual", allowCustomerNameEdit = false }: FollowUpDialogProps) {
  const [editableCustomerName, setEditableCustomerName] = useState(customerName);
  const [remarks, setRemarks] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const finalName = allowCustomerNameEdit ? editableCustomerName.trim() : customerName;
    if (allowCustomerNameEdit && !finalName) {
      toast({ title: "Customer name required", description: "Please enter a customer name.", variant: "destructive" });
      return;
    }
    if (!remarks.trim()) {
      toast({ title: "Remarks required", description: "Please enter follow-up remarks.", variant: "destructive" });
      return;
    }
    if (!nextDate) {
      toast({ title: "Next date required", description: "Please select the next follow-up date.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await addFollowUp({
        customerName: finalName,
        remarks: remarks.trim(),
        nextFollowUpDate: nextDate,
        type: defaultType,
      });
      toast({ title: "Follow-up Added", description: `Follow-up scheduled for ${finalName}` });
      setEditableCustomerName("");
      setRemarks("");
      setNextDate("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{allowCustomerNameEdit ? "Add New Follow-up" : `Add Follow-up — ${customerName}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {allowCustomerNameEdit && (
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                placeholder="Enter customer name..."
                value={editableCustomerName}
                onChange={(e) => setEditableCustomerName(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              placeholder="Enter follow-up remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Next Follow-up Date</Label>
            <Input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding..." : "Add Follow-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
