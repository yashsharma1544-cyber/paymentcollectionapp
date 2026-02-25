import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments, type RecordedPayment } from "@/lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentDialog } from "@/components/PaymentDialog";
import {
  ArrowLeft, RefreshCw, IndianRupee, FileText, AlertTriangle,
  CheckCircle, TrendingUp, Phone, MapPin, CreditCard, Clock,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Invoice } from "@/lib/invoice";

const CustomerDetail = () => {
  const { customerName } = useParams<{ customerName: string }>();
  const decoded = decodeURIComponent(customerName || "");
  const navigate = useNavigate();

  const {
    data: allInvoices = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });

  const {
    data: allPayments = [],
    isLoading: paymentsLoading,
  } = useQuery({ queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments });

  const invoices = useMemo(
    () => allInvoices.filter((inv) => inv.customerName === decoded),
    [allInvoices, decoded]
  );

  const payments = useMemo(
    () => allPayments.filter((p) => p.customerName === decoded),
    [allPayments, decoded]
  );

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const kpis = useMemo(() => {
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const overdue = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).length;
    const collectionRate = totalBill > 0 ? ((totalPaid / totalBill) * 100).toFixed(1) : "0";
    const totalRecordedPayments = payments.reduce((s, p) => s + p.paidAmount, 0);
    return { totalBill, totalPaid, totalOutstanding, overdue, collectionRate, totalRecordedPayments };
  }, [invoices, payments]);

  const info = invoices[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{decoded}</h1>
              {info && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {info.mobileNo && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{info.mobileNo}</span>
                  )}
                  {info.beat && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{info.beat}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm bg-destructive/10">
                <CardContent className="p-4 text-center">
                  <IndianRupee className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                  <p className="text-xl font-black text-destructive">₹{kpis.totalOutstanding.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-success/10">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Paid</p>
                  <p className="text-xl font-black text-success">₹{kpis.totalPaid.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collection %</p>
                  <p className="text-xl font-black text-primary">{kpis.collectionRate}%</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <FileText className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Billed</p>
                  <p className="text-xl font-black">₹{kpis.totalBill.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <FileText className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoices</p>
                  <p className="text-xl font-black">{invoices.length}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-warning/10">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                  <p className="text-xl font-black text-warning">{kpis.overdue}</p>
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
                        <TableHead className="text-xs font-semibold">Bill No</TableHead>
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Bill Amt</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
                        <TableHead className="text-xs font-semibold">Due</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.billNo} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-mono text-xs">{inv.billNo}</TableCell>
                          <TableCell className="text-xs">{inv.billDate}</TableCell>
                          <TableCell className="text-right text-xs font-medium">
                            ₹{inv.billAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-xs text-success font-medium">
                            ₹{inv.paidAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-xs text-destructive font-semibold">
                            ₹{inv.outstandingAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-xs">{inv.dueDate}</TableCell>
                          <TableCell><StatusBadge status={inv.paymentStatus} /></TableCell>
                          <TableCell className="text-center">
                            {inv.outstandingAmount > 0 && (
                              <Button
                                size="sm"
                                onClick={() => { setSelectedInvoice(inv); setDialogOpen(true); }}
                                className="gap-1.5 h-7 text-xs"
                              >
                                <CreditCard className="h-3 w-3" />
                                Collect
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
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
                  No recorded payments yet
                </div>
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
                            <TableCell className="text-right text-xs text-success font-semibold">
                              ₹{p.paidAmount.toLocaleString("en-IN")}
                            </TableCell>
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

      <PaymentDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};

export default CustomerDetail;
