import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments, fetchFollowUps, fetchWhatsAppLog, logWhatsApp, addFollowUp, type RecordedPayment, type FollowUp } from "@/lib/api";
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
import {
  ArrowLeft, RefreshCw, IndianRupee, FileText, AlertTriangle,
  CheckCircle, TrendingUp, Phone, MapPin, CreditCard, Clock, Wallet, MessageCircle, CalendarClock,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Invoice } from "@/lib/invoice";
import { getOverdueDays, formatOverdue } from "@/lib/date-utils";
import { buildReminderMessage, openWhatsApp } from "@/lib/whatsapp";
import { useToast } from "@/hooks/use-toast";

const CustomerDetail = () => {
  const { customerName } = useParams<{ customerName: string }>();
  const decoded = decodeURIComponent(customerName || "");
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const invoices = useMemo(() => allInvoices.filter((inv) => inv.customerName === decoded), [allInvoices, decoded]);
  const payments = useMemo(() => allPayments.filter((p) => p.customerName === decoded), [allPayments, decoded]);
  const followUps = useMemo(() => allFollowUps.filter((f) => f.customerName === decoded), [allFollowUps, decoded]);
  const lastWA = useMemo(() => {
    const entries = whatsAppLog.filter((e) => e.customerName === decoded);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }, [whatsAppLog, decoded]);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lumpsumOpen, setLumpsumOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const kpis = useMemo(() => {
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const overdueOutstanding = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).reduce((s, i) => s + i.outstandingAmount, 0);
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    const totalRecordedPayments = payments.reduce((s, p) => s + p.paidAmount, 0);
    return { totalBill, totalPaid, totalOutstanding, overdueOutstanding, collectionRate, totalRecordedPayments };
  }, [invoices, payments]);

  const info = invoices[0];

  const handleWhatsApp = async () => {
    const msg = buildReminderMessage(decoded, invoices);
    if (msg && info?.mobileNo) {
      openWhatsApp(info.mobileNo, msg);
      try {
        await logWhatsApp(decoded, info.mobileNo);
      } catch (e) {
        // silent fail for logging
      }
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
              <h1 className="text-lg font-bold tracking-tight truncate">{decoded}</h1>
              {info && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {info.mobileNo && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{info.mobileNo}</span>}
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
            <Button size="sm" variant="outline" onClick={handleWhatsApp}
              disabled={!info?.mobileNo || kpis.totalOutstanding === 0}
              className="gap-1.5 text-green-600 border-green-600 hover:bg-green-50 text-xs flex-1 sm:flex-none"
            >
              <MessageCircle className="h-3.5 w-3.5" />WhatsApp
            </Button>
            <Button size="sm" onClick={() => setLumpsumOpen(true)} className="gap-1.5 text-xs flex-1 sm:flex-none">
              <Wallet className="h-3.5 w-3.5" />Lumpsum
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setFollowUpOpen(true)} className="gap-1.5 text-xs flex-1 sm:flex-none">
              <CalendarClock className="h-3.5 w-3.5" />Follow-up
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 text-xs hidden sm:inline-flex">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh
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
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-3">
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
            </div>

            {/* Invoices Table */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Invoices</h2>
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
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-center whitespace-nowrap">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.billNo} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-mono text-xs whitespace-nowrap">{inv.billNo}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{inv.billDate}</TableCell>
                          <TableCell className="text-right text-xs font-medium whitespace-nowrap">₹{inv.billAmount.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right text-xs text-success font-medium whitespace-nowrap">₹{inv.paidAmount.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right text-xs text-destructive font-semibold whitespace-nowrap">₹{inv.outstandingAmount.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{inv.dueDate}</TableCell>
                          <TableCell className="text-center">
                            {inv.outstandingAmount > 0 ? (
                              <span className={`text-xs font-bold ${getOverdueDays(inv.dueDate) > 0 ? "text-destructive" : "text-success"}`}>
                                {formatOverdue(getOverdueDays(inv.dueDate))}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell><StatusBadge status={inv.paymentStatus} /></TableCell>
                          <TableCell className="text-center">
                            {inv.outstandingAmount > 0 && (
                              <Button size="sm" onClick={() => { setSelectedInvoice(inv); setDialogOpen(true); }} className="gap-1.5 h-7 text-xs">
                                <CreditCard className="h-3 w-3" />Collect
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Follow-ups Section */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Follow-ups
                <span className="text-xs font-normal normal-case">— {followUps.length} record{followUps.length !== 1 ? "s" : ""}</span>
              </h2>
              {followUpsLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : (
                <FollowUpList followUps={[...followUps].reverse()} />
              )}
            </div>

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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p, i) => (
                          <TableRow key={`${p.billNo}-${i}`} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-mono text-xs">{p.billNo}</TableCell>
                            <TableCell className="text-right text-xs text-success font-semibold">₹{p.paidAmount.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.timestamp}</TableCell>
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
    </div>
  );
};

export default CustomerDetail;
