import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments, fetchFollowUps, fetchWhatsAppLog, logWhatsApp, addFollowUp, deletePayment, fetchStoppedReminders, type RecordedPayment, type FollowUp } from "@/lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentDialog } from "@/components/PaymentDialog";
import { LumpsumPaymentDialog } from "@/components/LumpsumPaymentDialog";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { FollowUpList } from "@/components/FollowUpList";
import { WhatsAppChatView } from "@/components/WhatsAppChatView";
import { WhatsAppInvoiceSelector } from "@/components/WhatsAppInvoiceSelector";
import { ExportMenu } from "@/components/ExportMenu";
import {
  ArrowLeft, RefreshCw, IndianRupee, FileText, AlertTriangle,
  CheckCircle, TrendingUp, Phone, MapPin, CreditCard, Clock, Wallet, MessageCircle, CalendarClock, ChevronDown, Pencil, Trash2, BellOff, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/HealthBadge";
import { calculateHealthScore } from "@/lib/health-score";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EditPaymentDialog } from "@/components/EditPaymentDialog";
import { useMemo, useState } from "react";
import { getLastEscalationMap } from "@/lib/escalation";
import { type Invoice, sortInvoicesUnpaidFirst } from "@/lib/invoice";
import { getOverdueDays, formatOverdue, calcAvgCollectionDays, parseDateDMY } from "@/lib/date-utils";
import { buildReminderMessage, openWhatsApp, sendViaWati } from "@/lib/whatsapp";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useFocusCustomers } from "@/hooks/use-focus-customers";

const CustomerDetail = () => {
  const { customerName } = useParams<{ customerName: string }>();
  const decoded = decodeURIComponent(customerName || "");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useUser();
  const { isFocused, toggleFocus } = useFocusCustomers();

  const { data: allInvoices = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["invoices"], queryFn: fetchInvoices,
  });
  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments,
  });
  const { data: allFollowUps = [], isLoading: followUpsLoading, refetch: refetchFollowUps } = useQuery({
    queryKey: ["followups"], queryFn: fetchFollowUps,
  });
  const { data: whatsAppLog = [] } = useQuery({
    queryKey: ["whatsapp-log"], queryFn: fetchWhatsAppLog,
  });
  const { data: stoppedCustomers = [], refetch: refetchStopped } = useQuery({
    queryKey: ["stopped-reminders"],
    queryFn: fetchStoppedReminders,
  });
  const isReminderStopped = stoppedCustomers.includes(decoded);

  const invoices = useMemo(() => {
    const filtered = allInvoices.filter((inv) => inv.customerName === decoded);
    // Latest invoice first (by bill date descending), regardless of payment status
    return [...filtered].sort((a, b) => {
      const dateA = parseDateDMY(a.billDate);
      const dateB = parseDateDMY(b.billDate);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.getTime() - dateA.getTime();
    });
  }, [allInvoices, decoded]);
  const payments = useMemo(() => allPayments.filter((p) => p.customerName === decoded), [allPayments, decoded]);
  const followUps = useMemo(() => allFollowUps.filter((f) => f.customerName === decoded), [allFollowUps, decoded]);
  const lastWA = useMemo(() => {
    const entries = whatsAppLog.filter((e) => e.customerName === decoded);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }, [whatsAppLog, decoded]);

  const lastEscalation = useMemo(() => {
    const map = getLastEscalationMap(whatsAppLog);
    return map.get(decoded) || null;
  }, [whatsAppLog, decoded]);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lumpsumOpen, setLumpsumOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [whatsAppSelectorOpen, setWhatsAppSelectorOpen] = useState(false);
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());
  const [sendingWati, setSendingWati] = useState(false);
  const [editPaymentRec, setEditPaymentRec] = useState<RecordedPayment | null>(null);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecordedPayment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeletePayment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePayment(deleteTarget.billNo, deleteTarget.timestamp);
      toast({ title: "✅ Payment deleted successfully" });
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      toast({ title: "Failed to delete", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const toggleBillExpand = (billNo: string) => {
    setExpandedBills(prev => {
      const next = new Set(prev);
      if (next.has(billNo)) next.delete(billNo);
      else next.add(billNo);
      return next;
    });
  };

  const paymentsByBill = useMemo(() => {
    const map = new Map<string, RecordedPayment[]>();
    for (const p of payments) {
      if (!map.has(p.billNo)) map.set(p.billNo, []);
      map.get(p.billNo)!.push(p);
    }
    // Sort each bill's payments: latest first
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const da = parseDateDMY(a.paymentDate)?.getTime() || new Date(a.timestamp).getTime() || 0;
        const db = parseDateDMY(b.paymentDate)?.getTime() || new Date(b.timestamp).getTime() || 0;
        return db - da;
      });
    }
    return map;
  }, [payments]);

  const kpis = useMemo(() => {
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const overdueOutstanding = invoices.filter((i) => getOverdueDays(i.billDate) > 0 && i.outstandingAmount > 0).reduce((s, i) => s + i.outstandingAmount, 0);
    const collectionRate = totalBill > 0 ? Math.round((totalPaid / totalBill) * 100).toString() : "0";
    const totalRecordedPayments = payments.reduce((s, p) => s + p.paidAmount, 0);
    const avgCollectionDays = calcAvgCollectionDays(invoices, payments);

    return { totalBill, totalPaid, totalOutstanding, overdueOutstanding, collectionRate, totalRecordedPayments, avgCollectionDays };
  }, [invoices, payments]);

  const health = useMemo(() => calculateHealthScore(decoded, allInvoices, allPayments), [decoded, allInvoices, allPayments]);

  const info = invoices[0];
  // Find a valid phone number from any invoice (not just the first one)
  const customerPhone = useMemo(() => {
    for (const inv of invoices) {
      if (inv.mobileNo && inv.mobileNo.length >= 10 && !inv.mobileNo.startsWith("1111")) return inv.mobileNo;
    }
    return invoices[0]?.mobileNo || "";
  }, [invoices]);

  const handleWhatsApp = async (selectedInvoices: Invoice[]) => {
    if (!customerPhone || selectedInvoices.length === 0) return;
    const msg = buildReminderMessage(decoded, selectedInvoices);
    setSendingWati(true);
    try {
      const result = await sendViaWati(customerPhone, decoded, selectedInvoices);
      if (result.success) {
        await logWhatsApp(decoded, customerPhone, currentUser || undefined);
        toast({ title: "✅ WhatsApp sent via WATI", description: decoded });
      } else {
        openWhatsApp(customerPhone, msg);
        toast({ title: "⚠️ WATI failed, opened WhatsApp", description: result.error, variant: "destructive" });
      }
    } catch {
      openWhatsApp(customerPhone, msg);
      toast({ title: "⚠️ Fallback to WhatsApp link", variant: "destructive" });
    } finally {
      setSendingWati(false);
      setWhatsAppSelectorOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <IndianRupee className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleFocus(decoded)} className="shrink-0">
                  <Star className={`h-5 w-5 ${isFocused(decoded) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground hover:text-yellow-500"} transition-colors`} />
                </button>
                <h1 className="text-lg font-bold tracking-tight truncate">{decoded}</h1>
                <HealthBadge status={health.status} score={health.score} size="sm" />
                {isReminderStopped && (
                  <Badge variant="destructive" className="text-[10px] gap-1 shrink-0">
                    <BellOff className="h-3 w-3" />
                    Reminders Off
                  </Badge>
                )}
                {lastEscalation && (
                  <Badge variant="outline" className="text-[10px] gap-1 shrink-0 border-orange-500/30 text-orange-600">
                    📨 {lastEscalation}
                  </Badge>
                )}
              </div>
              {info && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {customerPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customerPhone}</span>}
                  {info.beat && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{info.beat}</span>}
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} className="shrink-0 sm:hidden">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Last WhatsApp indicator */}
          {lastWA ? (
            <div className="ml-10 flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5">
              <MessageCircle className="h-4 w-4 text-green-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-green-700">Last WhatsApp Sent</span>
                <span className="text-xs font-medium text-green-600">{lastWA.timestamp}</span>
              </div>
            </div>
          ) : (
            <div className="ml-10 flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-1.5">
              <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">No WhatsApp sent yet</span>
            </div>
          )}

          <div className="flex items-center gap-2 pl-10 flex-wrap">
            <Button size="sm" onClick={() => setLumpsumOpen(true)} className="gap-1.5 text-xs flex-1 sm:flex-none">
              <Wallet className="h-3.5 w-3.5" />Lumpsum
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setFollowUpOpen(true)} className="gap-1.5 text-xs flex-1 sm:flex-none">
              <CalendarClock className="h-3.5 w-3.5" />Follow-up
            </Button>
            <ExportMenu invoices={invoices} title={decoded} size="sm" payments={allPayments} />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 text-xs hidden sm:inline-flex">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh
            </Button>
            <div className="flex-1 sm:flex-none" />
            <Button size="sm" variant="outline" onClick={() => setWhatsAppSelectorOpen(true)}
              disabled={!customerPhone || sendingWati}
              className="gap-1.5 text-green-600 border-green-600 hover:bg-green-50 text-xs flex-1 sm:flex-none ml-auto"
            >
              {sendingWati ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              {sendingWati ? "Sending..." : "WhatsApp"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {error ? (
          <div className="text-center py-20">
            <p className="text-destructive font-medium mb-2">Failed to load data</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No invoices found for this customer</p>
            <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-3">
              <Card className="border-0 shadow-sm bg-destructive/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <IndianRupee className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-destructive mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Outstanding</p>
                  <p className="text-xs sm:text-xl font-black text-destructive truncate">₹{kpis.totalOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-success/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-success mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Paid</p>
                  <p className="text-xs sm:text-xl font-black text-success truncate">₹{kpis.totalPaid.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-primary mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Collection %</p>
                  <p className="text-xs sm:text-xl font-black text-primary">{kpis.collectionRate}%</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <FileText className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Billed</p>
                  <p className="text-xs sm:text-xl font-black truncate">₹{kpis.totalBill.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-warning/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-warning mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Overdue Amt</p>
                  <p className="text-xs sm:text-xl font-black text-warning truncate">₹{kpis.overdueOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-orange-500/10 overflow-hidden">
                <CardContent className="p-2 sm:p-4 text-center">
                  <Clock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-orange-600 mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">Avg Collection</p>
                  <p className="text-xs sm:text-xl font-black text-orange-600">{kpis.avgCollectionDays !== null ? `${kpis.avgCollectionDays}d` : "—"}</p>
                </CardContent>
              </Card>
            </div>

            {/* Follow-ups Section */}
            {(followUps.length > 0 || followUpsLoading) && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Follow-ups
                  <span className="text-xs font-normal normal-case">— {followUps.length} record{followUps.length !== 1 ? "s" : ""}</span>
                </h2>
                {followUpsLoading ? (
                  <Skeleton className="h-32 rounded-xl" />
                ) : (
                  <FollowUpList followUps={[...followUps].reverse()} stoppedCustomers={stoppedCustomers} onStopToggle={() => refetchStopped()} />
                )}
              </div>
            )}

            {/* Invoices Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Invoices</h2>
                {kpis.avgCollectionDays !== null && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600">
                    <Clock className="h-3.5 w-3.5" />
                    Avg: {kpis.avgCollectionDays}d
                  </span>
                )}
              </div>
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Bill No</TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Bill Amt</TableHead>
                        <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Paid</TableHead>
                        <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Outstanding</TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Due</TableHead>
                        <TableHead className="text-xs font-semibold text-center whitespace-nowrap">Overdue</TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Collected</TableHead>
                        <TableHead className="text-xs font-semibold text-center whitespace-nowrap">Days</TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-center whitespace-nowrap">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => {
                        const isPaid = inv.outstandingAmount === 0;
                        const billPayments = paymentsByBill.get(inv.billNo) || [];
                        const hasPayments = billPayments.length > 0;
                        const isExpanded = expandedBills.has(inv.billNo);
                        const isClickable = hasPayments;

                        // Last payment date and days to clear
                        const lastPayment = hasPayments ? billPayments[billPayments.length - 1] : null;
                        const collectedDate = lastPayment?.paymentDate || lastPayment?.timestamp?.split(" ")[0] || "";
                        const billDate = parseDateDMY(inv.billDate);
                        const paidDate = collectedDate ? parseDateDMY(collectedDate) : null;
                        let daysToClear: number | null = null;
                        if (billDate && paidDate) {
                          billDate.setHours(0, 0, 0, 0);
                          paidDate.setHours(0, 0, 0, 0);
                          daysToClear = Math.max(0, Math.floor((paidDate.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24)));
                        }

                        return (
                          <>
                            <TableRow
                              key={inv.billNo}
                              className={`transition-colors ${isClickable ? "cursor-pointer hover:bg-primary/5" : "hover:bg-muted/20"} ${isExpanded ? "bg-primary/5" : ""}`}
                              onClick={() => isClickable && toggleBillExpand(inv.billNo)}
                            >
                              <TableCell className="font-mono text-xs whitespace-nowrap">
                                <span className="flex items-center gap-1">
                                  {isClickable && (
                                    <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                  )}
                                  {inv.billNo}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{inv.billDate}</TableCell>
                              <TableCell className="text-right text-xs font-medium whitespace-nowrap">₹{inv.billAmount.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-right text-xs text-success font-medium whitespace-nowrap">₹{inv.paidAmount.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-right text-xs text-destructive font-semibold whitespace-nowrap">₹{inv.outstandingAmount.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{inv.dueDate}</TableCell>
                              <TableCell className="text-center">
                                {inv.outstandingAmount > 0 ? (
                                  <span className={`text-xs font-bold ${getOverdueDays(inv.billDate) > 0 ? "text-destructive" : "text-success"}`}>
                                    {formatOverdue(getOverdueDays(inv.billDate))}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {collectedDate ? (
                                  <span className="text-success font-medium">{collectedDate}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {daysToClear !== null ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${daysToClear <= 30 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"}`}>
                                      {daysToClear}d
                                    </span>
                                    {kpis.avgCollectionDays !== null && (
                                      <span className={`text-[9px] font-medium ${daysToClear <= kpis.avgCollectionDays ? "text-success" : "text-destructive"}`}>
                                        {daysToClear <= kpis.avgCollectionDays ? "▼" : "▲"} {Math.abs(daysToClear - kpis.avgCollectionDays)}d
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell><StatusBadge status={inv.paymentStatus} /></TableCell>
                              <TableCell className="text-center">
                                {inv.outstandingAmount > 0 && (
                                  <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); setDialogOpen(true); }} className="gap-1.5 h-7 text-xs">
                                    <CreditCard className="h-3 w-3" />Collect
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {isExpanded && billPayments.map((p, pi) => (
                              <TableRow key={`${inv.billNo}-pay-${pi}`} className="bg-muted/20 border-l-2 border-l-primary/30">
                                <TableCell colSpan={2} className="text-[11px] text-muted-foreground pl-8">
                                  Payment #{pi + 1}
                                </TableCell>
                                <TableCell className="text-right text-[11px] font-medium text-success">₹{p.paidAmount.toLocaleString("en-IN")}</TableCell>
                                <TableCell className="text-[11px] text-muted-foreground" colSpan={2}>
                                  {p.paymentDate || p.timestamp}
                                  {p.paymentMode && <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{p.paymentMode}</span>}
                                </TableCell>
                                <TableCell className="text-[11px] text-muted-foreground">
                                  {p.discount > 0 && <span className="text-primary font-medium">Disc: ₹{p.discount.toLocaleString("en-IN")}</span>}
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground">{p.timestamp}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditPaymentRec(p); setEditPaymentOpen(true); }}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* WhatsApp Chat */}
            {customerPhone && (
              <WhatsAppChatView phone={customerPhone} customerName={decoded} />
            )}

            {/* Payment History */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Payment History
                {!paymentsLoading && (
                  <span className="text-xs font-normal normal-case">
                    — ₹{kpis.totalRecordedPayments.toLocaleString("en-IN")} across {payments.length} payment{payments.length !== 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              {paymentsLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : payments.length === 0 ? (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">No recorded payments yet</div>
              ) : (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                         <TableHead className="text-xs font-semibold">Bill No</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Amount Paid</TableHead>
                          <TableHead className="text-xs font-semibold">Date & Time</TableHead>
                          <TableHead className="text-xs font-semibold">Collected By</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p, i) => (
                          <TableRow key={`${p.billNo}-${i}`} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-mono text-xs">{p.billNo}</TableCell>
                            <TableCell className="text-right text-xs text-success font-semibold">₹{p.paidAmount.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.timestamp}</TableCell>
                            <TableCell className="text-xs font-medium">{p.collectedBy || "—"}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditPaymentRec(p); setEditPaymentOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <PaymentDialog invoice={selectedInvoice} open={dialogOpen} onClose={() => setDialogOpen(false)} onSuccess={() => refetch()} />
      <LumpsumPaymentDialog invoices={invoices} customerName={decoded} open={lumpsumOpen} onClose={() => setLumpsumOpen(false)} onSuccess={() => refetch()} />
      <FollowUpDialog customerName={decoded} open={followUpOpen} onClose={() => setFollowUpOpen(false)} onSuccess={() => refetchFollowUps()} />
      <EditPaymentDialog payment={editPaymentRec} open={editPaymentOpen} onOpenChange={setEditPaymentOpen} onSuccess={() => refetch()} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the payment of ₹{deleteTarget?.paidAmount.toLocaleString("en-IN")} for bill {deleteTarget?.billNo}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WhatsAppInvoiceSelector
        open={whatsAppSelectorOpen}
        onClose={() => setWhatsAppSelectorOpen(false)}
        invoices={invoices}
        onSend={handleWhatsApp}
        sending={sendingWati}
      />
    </div>
  );
};

export default CustomerDetail;
