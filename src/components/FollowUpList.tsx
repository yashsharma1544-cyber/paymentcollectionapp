import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FollowUp } from "@/lib/api";
import { updateFollowUpStatus, editFollowUp } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CalendarClock, MessageSquare, Clock, CheckCircle, Pencil } from "lucide-react";
import { toast } from "sonner";

interface FollowUpListProps {
  followUps: FollowUp[];
  showCustomerName?: boolean;
}

export function FollowUpList({ followUps, showCustomerName = false }: FollowUpListProps) {
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [editRemarks, setEditRemarks] = useState("");
  const [editNextDate, setEditNextDate] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const queryClient = useQueryClient();

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
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
        No follow-ups recorded yet
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {followUps.map((f, i) => {
          const key = `${f.customerName}-${f.createdAt}`;
          const isMarking = markingDone === key;
          return (
            <Card key={i} className="border shadow-sm">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {showCustomerName && (
                      <p className="text-sm font-semibold truncate">{f.customerName}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{f.followUpDate} {f.followUpTime}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={f.type === "Payment" ? "default" : f.type === "Overdue" ? "destructive" : "secondary"} className="text-[10px]">
                      {f.type}
                    </Badge>
                    <Badge variant={f.status === "Pending" ? "outline" : "secondary"} className="text-[10px]">
                      {f.status}
                    </Badge>
                  </div>
                </div>
                {f.remarks && (
                  <div className="flex items-start gap-1.5">
                    <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-xs">{f.remarks}</p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  {f.nextFollowUpDate ? (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      <span>Next: {f.nextFollowUpDate}</span>
                    </div>
                  ) : <div />}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => openEdit(f)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    {f.status === "Pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-green-600 border-green-600 hover:bg-green-50"
                        disabled={isMarking}
                        onClick={() => handleMarkDone(f)}
                      >
                        <CheckCircle className="h-3 w-3" />
                        {isMarking ? "Saving..." : "Done"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
    </>
  );
}