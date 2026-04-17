import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments, fetchFollowUps, fetchWhatsAppLog, logWhatsApp, addFollowUp, deletePayment, fetchStoppedReminders, type RecordedPayment, type FollowUp } from "@/lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
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
  CheckCircle, TrendingUp, Phone, MapPin, CreditCard, Clock, Wallet, MessageCircle, CalendarClock, Pencil, Trash2, BellOff, Star, Sparkles, BookOpen,
} from "lucide-react";
import { CustomerInsightDialog } from "@/components/CustomerInsightDialog";
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
  const [insightOpen, setInsightOpen] = useState(false);

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

  // Unified ledger: chronological debits (invoices) + credits (payments) with running balance
  type LedgerEntry = {
    kind: "debit" | "credit";
    date: Date | null;
    dateStr: string;
    invoice?: Invoice;
    payment?: RecordedPayment;
    balance: number;
  };

  const ledger = useMemo<LedgerEntry[]>(() => {
    const entries: LedgerEntry[] = [];
    for (const inv of invoices) {
      entries.push({ kind: "debit", date: parseDateDMY(inv.billDate), dateStr: inv.billDate, invoice: inv, balance: 0 });
    }
    for (const p of payments) {
      const dStr = p.paymentDate || p.timestamp?.split(" ")[0] || "";
      entries.push({ kind: "credit", date: parseDateDMY(dStr), dateStr: dStr || p.timestamp, payment: p, balance: 0 });
    }
    entries.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return -1;
      if (!b.date) return 1;
      return a.date.getTime() - b.date.getTime();
    });
    let balance = 0;
    for (const e of entries) {
      if (e.kind === "debit") balance += e.invoice!.billAmount;
      else balance -= e.payment!.paidAmount + (e.payment!.discount || 0);
      e.balance = balance;
    }
    return entries.reverse();
  }, [invoices, payments]);

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

  const initials = decoded.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky translucent header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Customer</p>
            <p className="text-sm font-bold font-display truncate">{decoded}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 rounded-xl h-9">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6 max-w-7xl">
        {/* Hero customer card */}
        {!isLoading && !error && invoices.length > 0 && (
          <section className="rounded-3xl border surface-hero p-5 sm:p-7 shadow-card overflow-hidden relative">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-primary opacity-10 blur-3xl" aria-hidden />
            <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center text-xl sm:text-2xl font-bold font-display shrink-0 shadow-glow">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight leading-tight">{decoded}</h1>
                  <button onClick={() => toggleFocus(decoded)} className="shrink-0 p-1 rounded-lg hover:bg-warning/20 transition-colors">
                    <Star className={`h-5 w-5 ${isFocused(decoded) ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                  </button>
                  <button onClick={() => setInsightOpen(true)} className="shrink-0 p-1 rounded-lg hover:bg-accent/20 transition-colors" title="AI insight">
                    <Sparkles className="h-5 w-5 text-accent" />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <HealthBadge status={health.status} score={health.score} size="md" />
                  {isReminderStopped && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-0.5 border border-destructive/20">
                      <BellOff className="h-3 w-3" />Reminders Off
                    </span>
                  )}
                  {lastEscalation && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning text-[11px] font-semibold px-2 py-0.5 border border-warning/20">
                      📨 {lastEscalation}
                    </span>
                  )}
                </div>
                {info && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2.5 flex-wrap">
                    {customerPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customerPhone}</span>}
                    {info.beat && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{info.beat}</span>}
                    {lastWA ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <MessageCircle className="h-3.5 w-3.5" />Last WA: {lastWA.timestamp}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />No WhatsApp sent
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action bar */}
            <div className="relative mt-5 flex items-center gap-2 flex-wrap">
              <Button onClick={() => setLumpsumOpen(true)} className="gap-2 bg-gradient-primary shadow-glow rounded-xl">
                <Wallet className="h-4 w-4" />Lumpsum Payment
              </Button>
              <Button variant="secondary" onClick={() => setFollowUpOpen(true)} className="gap-2 rounded-xl">
                <CalendarClock className="h-4 w-4" />Follow-up
              </Button>
              <Button
                variant="outline"
                onClick={() => setWhatsAppSelectorOpen(true)}
                disabled={!customerPhone || sendingWati}
                className="gap-2 rounded-xl text-success border-success/40 hover:bg-success/10"
              >
                {sendingWati ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                {sendingWati ? "Sending..." : "WhatsApp"}
              </Button>
              <ExportMenu invoices={invoices} title={decoded} size="sm" payments={allPayments} />
            </div>
          </section>
        )}

        {error ? (
          <div className="rounded-2xl border bg-card p-12 text-center shadow-card">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-semibold mb-1">Failed to load data</p>
            <Button onClick={() => refetch()} className="mt-3">Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-3xl" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border bg-card p-12 text-center shadow-card">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold mb-1">No invoices found</p>
            <p className="text-sm text-muted-foreground mb-4">This customer has no records yet.</p>
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Outstanding" value={`₹${kpis.totalOutstanding.toLocaleString("en-IN")}`} icon={IndianRupee} tone="destructive" emphasis />
              <StatCard label="Paid" value={`₹${kpis.totalPaid.toLocaleString("en-IN")}`} icon={CheckCircle} tone="success" />
              <StatCard label="Collection %" value={`${kpis.collectionRate}%`} icon={TrendingUp} tone="primary" />
              <StatCard label="Billed" value={`₹${kpis.totalBill.toLocaleString("en-IN")}`} icon={FileText} tone="muted" />
              <StatCard label="Overdue Amt" value={`₹${kpis.overdueOutstanding.toLocaleString("en-IN")}`} icon={AlertTriangle} tone="warning" />
              <StatCard label="Avg Collection" value={kpis.avgCollectionDays !== null ? `${kpis.avgCollectionDays}d` : "—"} icon={Clock} tone="warning" />
            </div>

            {/* Follow-ups Section */}
            {(followUps.length > 0 || followUpsLoading) && (
              <section className="rounded-2xl border bg-card shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <CalendarClock className="h-4 w-4 text-primary" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold font-display leading-tight">Follow-ups</h2>
                      <p className="text-[11px] text-muted-foreground">{followUps.length} record{followUps.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 sm:px-5 pb-4">
                  {followUpsLoading ? (
                    <Skeleton className="h-32 rounded-xl" />
                  ) : (
                    <FollowUpList followUps={[...followUps].reverse()} stoppedCustomers={stoppedCustomers} onStopToggle={() => refetchStopped()} />
                  )}
                </div>
              </section>
            )}

            {/* Customer Ledger - unified chronological journal */}
            <section className="rounded-2xl border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold font-display leading-tight">Customer Ledger</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {invoices.length} bill{invoices.length !== 1 ? "s" : ""} · {payments.length} payment{payments.length !== 1 ? "s" : ""} · newest first
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />Debit
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-success/10 text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />Credit
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    Balance ₹{kpis.totalOutstanding.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-24">Date</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Particulars</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap">Debit</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap">Credit</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap">Balance</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status / Days</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center whitespace-nowrap w-28">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((e, i) => {
                      if (e.kind === "debit") {
                        const inv = e.invoice!;
                        const overdue = getOverdueDays(inv.billDate);
                        return (
                          <TableRow key={`d-${inv.billNo}-${i}`} className="hover:bg-destructive/5 transition-colors border-l-2 border-l-destructive/40">
                            <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{e.dateStr}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold">Invoice <span className="font-mono text-primary">#{inv.billNo}</span></span>
                                <span className="text-[10px] text-muted-foreground">Due: {inv.dueDate}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-bold tabular-nums text-destructive">₹{inv.billAmount.toLocaleString("en-IN")}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                            <TableCell className="text-right">
                              <span className="text-xs font-bold tabular-nums">₹{e.balance.toLocaleString("en-IN")}</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <StatusBadge status={inv.paymentStatus} />
                                {inv.outstandingAmount > 0 && (
                                  <span className={`text-[10px] font-semibold ${overdue > 0 ? "text-destructive" : "text-success"}`}>
                                    {formatOverdue(overdue)} · ₹{inv.outstandingAmount.toLocaleString("en-IN")} due
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {inv.outstandingAmount > 0 && (
                                <Button size="sm" onClick={() => { setSelectedInvoice(inv); setDialogOpen(true); }} className="gap-1.5 h-7 text-xs rounded-lg">
                                  <CreditCard className="h-3 w-3" />Collect
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      }
                      const p = e.payment!;
                      const userInitials = p.collectedBy ? p.collectedBy.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "—";
                      const totalCredit = p.paidAmount + (p.discount || 0);
                      return (
                        <TableRow key={`c-${p.billNo}-${i}`} className="hover:bg-success/5 transition-colors border-l-2 border-l-success/40">
                          <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{e.dateStr}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold">
                                Payment vs <span className="font-mono text-primary">#{p.billNo}</span>
                                {p.paymentMode && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-muted text-[9px] font-medium uppercase tracking-wider">{p.paymentMode}</span>}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                {p.collectedBy && (
                                  <>
                                    <span className="h-4 w-4 rounded bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">{userInitials}</span>
                                    <span>{p.collectedBy}</span>
                                  </>
                                )}
                                {p.discount > 0 && <span className="text-primary font-medium">· Discount ₹{p.discount.toLocaleString("en-IN")}</span>}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-bold tabular-nums text-success">₹{totalCredit.toLocaleString("en-IN")}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-xs font-bold tabular-nums">₹{e.balance.toLocaleString("en-IN")}</span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                              <CheckCircle className="h-2.5 w-2.5" />Received
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { setEditPaymentRec(p); setEditPaymentOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(p)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Ledger footer totals */}
              <div className="border-t bg-muted/20 px-4 sm:px-5 py-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-foreground uppercase tracking-wider font-semibold">Total Debits</span>
                    <span className="font-bold tabular-nums text-destructive">₹{kpis.totalBill.toLocaleString("en-IN")}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-foreground uppercase tracking-wider font-semibold">Total Credits</span>
                    <span className="font-bold tabular-nums text-success">₹{kpis.totalPaid.toLocaleString("en-IN")}</span>
                  </span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Closing Balance</span>
                  <span className="text-base font-bold font-display tabular-nums text-primary">
                    ₹{kpis.totalOutstanding.toLocaleString("en-IN")} Dr
                  </span>
                </div>
              </div>
            </section>

            {/* WhatsApp Chat */}
            {customerPhone && (
              <WhatsAppChatView phone={customerPhone} customerName={decoded} />
            )}
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

      <CustomerInsightDialog
        open={insightOpen}
        onOpenChange={setInsightOpen}
        customerName={decoded}
      />
    </div>
  );
};

export default CustomerDetail;
