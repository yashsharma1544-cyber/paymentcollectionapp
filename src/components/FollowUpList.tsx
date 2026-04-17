import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { FollowUp } from "@/lib/api";
import { updateFollowUpStatus, editFollowUp, deleteFollowUp, fetchInvoices, stopReminders, resumeReminders } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarClock, MessageSquare, Clock, CheckCircle, Pencil, CreditCard, Send, Trash2, BellOff, Bell, CalendarSearch, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { LumpsumPaymentDialog } from "@/components/LumpsumPaymentDialog";
import { sendManualReminder, sendDateNudge } from "@/lib/reminder";

interface FollowUpListProps {
  followUps: FollowUp[];
  showCustomerName?: boolean;
  stoppedCustomers?: string[];
  onStopToggle?: () => void;
}

export function FollowUpList({ followUps, showCustomerName = false, stoppedCustomers = [], onStopToggle }: FollowUpListProps) {
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [togglingStop, setTogglingStop] = useState<string | null>(null);
  const [nudgingDate, setNudgingDate] = useState<string | null>(null);
  const [deletingFollowUp, setDeletingFollowUp] = useState<string | null>(null);
  const [stopConfirm, setStopConfirm] = useState<{ customerName: string; isStopped: boolean } | null>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [editRemarks, setEditRemarks] = useState("");
  const [editNextDate, setEditNextDate] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: allInvoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const handleMarkDone = async (f: FollowUp) => {
    const key = `${f.customerName}-${f.createdAt}`;
    setMarkingDone(key);
    try {
      await updateFollowUpStatus(f.customerName, f.createdAt, "Done");
      toast.success("Follow-up marked as Done");
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    } catch (e) {
      toast.error("Failed to update follow-up");
    } finally {
      setMarkingDone(null);
    }
  };

  const openEdit = (f: FollowUp) => {
    setEditingFollowUp(f);
    setEditRemarks(f.remarks);
    setEditNextDate(f.nextFollowUpDate || "");
    setEditStatus(f.status);
  };

  const handleEditSave = async () => {
    if (!editingFollowUp) return;
    setEditLoading(true);
    try {
      await editFollowUp({
        customerName: editingFollowUp.customerName,
        createdAt: editingFollowUp.createdAt,
        remarks: editRemarks.trim(),
        nextFollowUpDate: editNextDate,
        status: editStatus,
      });
      toast.success("Follow-up updated");
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setEditingFollowUp(null);
    } catch (e) {
      toast.error("Failed to update follow-up");
    } finally {
      setEditLoading(false);
    }
  };

  if (followUps.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed bg-muted/20 p-8 text-center">
        <CalendarClock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No follow-ups recorded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {followUps.map((f, i) => {
          const key = `${f.customerName}-${f.createdAt}`;
          const isMarking = markingDone === key;
          const isStopped = stoppedCustomers.includes(f.customerName);
          const typeStyle =
            f.type === "Payment" ? "bg-primary/10 text-primary border-primary/20" :
            f.type === "Overdue" ? "bg-destructive/10 text-destructive border-destructive/20" :
            "bg-secondary text-secondary-foreground border-border";
          const statusStyle =
            f.status === "Pending" ? "bg-warning/10 text-warning border-warning/20" :
            "bg-success/10 text-success border-success/20";
          return (
            <div
              key={i}
              className={cn(
                "rounded-2xl border bg-card shadow-card p-3.5 sm:p-4 transition-all hover:shadow-elevated",
                isStopped && "opacity-60 border-dashed",
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  {showCustomerName && (
                    <p className="text-sm font-semibold font-display truncate mb-0.5">{f.customerName}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {f.followUpDate} {f.followUpTime}
                    </span>
                    {f.addedBy && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-muted/70 px-1.5 py-0.5 rounded-full">
                        <span className="h-3.5 w-3.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold inline-flex items-center justify-center">
                          {f.addedBy.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                        {f.addedBy.split(" ")[0]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {f.remarks?.includes("Reminder Sent") && (
                    <span className="inline-flex items-center gap-0.5 rounded-full text-[10px] font-semibold px-1.5 py-0.5 border bg-primary/10 text-primary border-primary/20">
                      <MailCheck className="h-2.5 w-2.5" />
                      Sent
                    </span>
                  )}
                  <span className={cn("inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 border", typeStyle)}>
                    {f.type}
                  </span>
                  <span className={cn("inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 border", statusStyle)}>
                    {f.status}
                  </span>
                </div>
              </div>

              {f.remarks && (
                <div className="flex items-start gap-2 px-2.5 py-2 mb-2 rounded-lg bg-muted/40">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-xs leading-relaxed flex-1">{f.remarks}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                {f.nextFollowUpDate ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    Next: {f.nextFollowUpDate}
                  </span>
                ) : <div />}
                <div className="flex items-center gap-0.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-primary rounded-lg"
                    disabled={sendingReminder === key}
                    onClick={async () => {
                      setSendingReminder(key);
                      try {
                        const result = await sendManualReminder(f.customerName, f.nextFollowUpDate);
                        if (result.success) toast.success(`Reminder sent to ${f.customerName}`);
                        else toast.error(result.error || "Failed to send reminder");
                      } catch {
                        toast.error("Failed to send reminder");
                      } finally {
                        setSendingReminder(null);
                      }
                    }}
                  >
                    <Send className="h-3 w-3" />
                    {sendingReminder === key ? "..." : "Remind"}
                  </Button>
                  {f.status === "Pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-warning rounded-lg"
                      disabled={nudgingDate === key}
                      onClick={async () => {
                        setNudgingDate(key);
                        try {
                          const result = await sendDateNudge(f.customerName);
                          if (result.success) toast.success(`Date nudge sent to ${f.customerName}`);
                          else toast.error(result.error || "Failed to send nudge");
                        } catch {
                          toast.error("Failed to send nudge");
                        } finally {
                          setNudgingDate(null);
                        }
                      }}
                    >
                      <CalendarSearch className="h-3 w-3" />
                      {nudgingDate === key ? "..." : "Ask Date"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 rounded-lg" onClick={() => setPaymentCustomer(f.customerName)}>
                    <CreditCard className="h-3 w-3" />Pay
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 rounded-lg" onClick={() => openEdit(f)}>
                    <Pencil className="h-3 w-3" />Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-destructive rounded-lg hover:bg-destructive/10"
                    disabled={deletingFollowUp === key}
                    onClick={async () => {
                      if (!confirm(`Delete follow-up for ${f.customerName}?`)) return;
                      setDeletingFollowUp(key);
                      try {
                        await deleteFollowUp(f.customerName, f.createdAt);
                        toast.success("Follow-up deleted");
                        queryClient.invalidateQueries({ queryKey: ["followups"] });
                      } catch {
                        toast.error("Failed to delete");
                      } finally {
                        setDeletingFollowUp(null);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    {deletingFollowUp === key ? "..." : "Del"}
                  </Button>
                  {f.status === "Pending" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-gradient-success text-success-foreground rounded-lg"
                      disabled={isMarking}
                      onClick={() => handleMarkDone(f)}
                    >
                      <CheckCircle className="h-3 w-3" />
                      {isMarking ? "Saving..." : "Done"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn("h-7 text-xs gap-1 rounded-lg", isStopped ? "text-success" : "text-warning")}
                    disabled={togglingStop === f.customerName}
                    onClick={() => setStopConfirm({ customerName: f.customerName, isStopped })}
                  >
                    {isStopped ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                    {togglingStop === f.customerName ? "..." : isStopped ? "Resume" : "Stop"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Follow-up Dialog */}
      <Dialog open={!!editingFollowUp} onOpenChange={(v) => !v && setEditingFollowUp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Follow-up{editingFollowUp?.customerName ? ` — ${editingFollowUp.customerName}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Enter follow-up remarks..."
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Next Follow-up Date</Label>
              <Input
                type="date"
                value={editNextDate}
                onChange={(e) => setEditNextDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={editStatus === "Pending" ? "default" : "outline"}
                  onClick={() => setEditStatus("Pending")}
                  className="flex-1"
                >
                  Pending
                </Button>
                <Button
                  size="sm"
                  variant={editStatus === "Done" ? "default" : "outline"}
                  onClick={() => setEditStatus("Done")}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFollowUp(null)} disabled={editLoading}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop/Resume Confirmation Dialog */}
      <AlertDialog open={!!stopConfirm} onOpenChange={(v) => !v && setStopConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {stopConfirm?.isStopped ? "Resume Reminders?" : "Stop Reminders?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {stopConfirm?.isStopped
                ? `Are you sure you want to resume automated reminders for ${stopConfirm.customerName}?`
                : `Are you sure you want to stop all automated reminders for ${stopConfirm?.customerName}? You can resume them later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!stopConfirm) return;
                setTogglingStop(stopConfirm.customerName);
                try {
                  if (stopConfirm.isStopped) {
                    await resumeReminders(stopConfirm.customerName);
                    toast.success(`Reminders resumed for ${stopConfirm.customerName}`);
                  } else {
                    await stopReminders(stopConfirm.customerName);
                    toast.success(`Reminders stopped for ${stopConfirm.customerName}`);
                  }
                  onStopToggle?.();
                } catch {
                  toast.error("Failed to update reminder status");
                } finally {
                  setTogglingStop(null);
                  setStopConfirm(null);
                }
              }}
            >
              {stopConfirm?.isStopped ? "Resume" : "Stop"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {paymentCustomer && (
        <LumpsumPaymentDialog
          invoices={allInvoices.filter((inv) => inv.customerName === paymentCustomer)}
          customerName={paymentCustomer}
          open={!!paymentCustomer}
          onClose={() => setPaymentCustomer(null)}
          onSuccess={() => {
            setPaymentCustomer(null);
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      )}
    </>
  );
}