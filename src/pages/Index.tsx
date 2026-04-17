import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments, fetchWhatsAppLog } from "@/lib/api";
import { BeatChart } from "@/components/BeatChart";
import { InvoiceTable } from "@/components/InvoiceTable";
import {
  RefreshCw, History, IndianRupee, Search, X, Users, TrendingUp, CalendarClock,
  Download, AlertTriangle, ClipboardList, Timer, ArrowLeft, Brain, Route,
  BarChart3, ShieldCheck, Shield, ShieldAlert, Star, Sparkles, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { getOverdueDays, calcAvgCollectionDays } from "@/lib/date-utils";
import { BulkWatiSend } from "@/components/BulkWatiSend";
import { DailyTarget } from "@/components/DailyTarget";
import { calculateAllHealthScores } from "@/lib/health-score";
import { TopDefaultersCard } from "@/components/TopDefaultersCard";
import { DailyBriefCard } from "@/components/DailyBriefCard";
import { StatCard } from "@/components/StatCard";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const Index = () => {
  const {
    data: invoices = [], isLoading, error, refetch, isFetching,
  } = useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments,
  });

  const { data: whatsappLog = [] } = useQuery({
    queryKey: ["whatsapp-log"], queryFn: fetchWhatsAppLog,
  });

  const [globalSearch, setGlobalSearch] = useState("");
  const [showSlowPayers, setShowSlowPayers] = useState(false);
  const { currentUser } = useUser();

  const searchResults = useMemo(() => {
    if (!globalSearch) return null;
    const q = globalSearch.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.customerName.toLowerCase().includes(q) ||
        inv.billNo.toLowerCase().includes(q) ||
        inv.mobileNo.includes(globalSearch)
    );
  }, [invoices, globalSearch]);

  const slowPayerCustomers = useMemo(() => {
    const customerMap = new Map<string, { invoices: { billNo: string; billDate: string }[] }>();
    for (const inv of invoices) {
      if (!customerMap.has(inv.customerName)) customerMap.set(inv.customerName, { invoices: [] });
      customerMap.get(inv.customerName)!.invoices.push({ billNo: inv.billNo, billDate: inv.billDate });
    }
    const slow = new Set<string>();
    for (const [name, data] of customerMap) {
      const custPayments = allPayments.filter(p => data.invoices.some(i => i.billNo === p.billNo));
      const avg = calcAvgCollectionDays(data.invoices, custPayments);
      if (avg !== null && avg > 30) slow.add(name);
    }
    return slow;
  }, [invoices, allPayments]);

  const kpiInvoices = useMemo(() => {
    if (!showSlowPayers) return invoices;
    return invoices.filter(i => slowPayerCustomers.has(i.customerName));
  }, [invoices, showSlowPayers, slowPayerCustomers]);

  const kpiPayments = useMemo(() => {
    if (!showSlowPayers) return allPayments;
    return allPayments.filter(p => slowPayerCustomers.has(p.customerName));
  }, [allPayments, showSlowPayers, slowPayerCustomers]);

  const kpis = useMemo(() => {
    const totalOutstanding = kpiInvoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = kpiInvoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = kpiInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(kpiInvoices.map((i) => i.customerName)).size;
    const overdueOutstanding = kpiInvoices.filter((i) => getOverdueDays(i.billDate) > 0 && i.outstandingAmount > 0).reduce((s, i) => s + i.outstandingAmount, 0);
    const remainingOutstanding = totalOutstanding - overdueOutstanding;
    const collectionRate = totalBill > 0 ? Math.round((totalPaid / totalBill) * 100).toString() : "0";
    const avgCollectionDays = calcAvgCollectionDays(kpiInvoices, kpiPayments);
    return { totalOutstanding, totalPaid, customers, overdueOutstanding, remainingOutstanding, collectionRate, avgCollectionDays };
  }, [kpiInvoices, kpiPayments]);

  const healthSummary = useMemo(() => {
    const scores = calculateAllHealthScores(invoices, allPayments);
    let good = 0, avg = 0, risky = 0;
    for (const h of scores.values()) {
      if (h.status === "Good") good++;
      else if (h.status === "Average") avg++;
      else risky++;
    }
    return { good, avg, risky };
  }, [invoices, allPayments]);

  const todayPayments = useMemo(() => {
    const now = new Date();
    return allPayments.filter(p => {
      if (!p.timestamp) return false;
      const match = p.timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      }
      const d = new Date(p.timestamp);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }, [allPayments]);

  const formatDate = () =>
    new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const quickLinks = [
    { to: "/due-today", label: "Due Today", icon: CalendarClock, tone: "primary" as const },
    { to: "/defaulters", label: "Defaulters", icon: AlertTriangle, tone: "destructive" as const },
    { to: "/focus", label: "Focus", icon: Star, tone: "warning" as const },
    { to: "/crm", label: "CRM", icon: Users, tone: "primary" as const },
    { to: "/predictions", label: "AI Predict", icon: Brain, tone: "accent" as const },
    { to: "/route-planner", label: "Routes", icon: Route, tone: "primary" as const },
    { to: "/daily-report", label: "Daily Report", icon: ClipboardList, tone: "primary" as const },
    { to: "/monthly-report", label: "Monthly", icon: BarChart3, tone: "primary" as const },
    { to: "/payments", label: "Payments Log", icon: History, tone: "primary" as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky translucent header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center shrink-0">
              <IndianRupee className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold font-display leading-tight truncate">Payment Collector</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">{formatDate()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/install" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Download className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5 h-9 rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6 max-w-7xl">
        {error ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-semibold mb-1">Failed to load invoices</p>
            <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-32 rounded-2xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Hero greeting */}
            <section className="rounded-3xl border surface-hero p-5 sm:p-7 shadow-card overflow-hidden relative">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-primary opacity-10 blur-3xl" aria-hidden />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground font-medium">{greeting()},</p>
                  <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight mt-0.5 truncate">
                    {currentUser} <span className="inline-block">👋</span>
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    You have <span className="font-semibold text-foreground tabular-nums">₹{kpis.totalOutstanding.toLocaleString("en-IN")}</span> outstanding across <span className="font-semibold text-foreground">{kpis.customers}</span> customers.
                  </p>
                </div>
                <div className="flex items-end justify-between sm:flex-col sm:items-end gap-2 sm:gap-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">Total Outstanding</p>
                  <p className="text-2xl sm:text-4xl font-bold font-display tabular-nums text-gradient-primary leading-none truncate">
                    ₹{kpis.totalOutstanding.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </section>

            {/* Daily Brief + Daily Target side by side on desktop */}
            <div className="grid lg:grid-cols-2 gap-5">
              <DailyBriefCard />
              <DailyTarget todayPayments={todayPayments} />
            </div>

            {/* KPI Grid */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold font-display uppercase tracking-wider text-muted-foreground">Overview</h2>
                {showSlowPayers && (
                  <Button variant="ghost" size="sm" onClick={() => setShowSlowPayers(false)} className="gap-1.5 text-xs h-8">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Show all
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard
                  label="Outstanding"
                  value={`₹${kpis.totalOutstanding.toLocaleString("en-IN")}`}
                  icon={IndianRupee}
                  tone="destructive"
                  emphasis
                />
                <StatCard
                  label="Collected"
                  value={`₹${kpis.totalPaid.toLocaleString("en-IN")}`}
                  icon={TrendingUp}
                  tone="success"
                />
                <StatCard
                  label="Collection %"
                  value={`${kpis.collectionRate}%`}
                  icon={TrendingUp}
                  tone="primary"
                />
                <StatCard
                  label="Customers"
                  value={kpis.customers}
                  icon={Users}
                  tone="muted"
                />
                <StatCard
                  label="Overdue"
                  value={`₹${kpis.overdueOutstanding.toLocaleString("en-IN")}`}
                  icon={AlertTriangle}
                  tone="warning"
                  to="/defaulters"
                />
                <StatCard
                  label="Avg Collection"
                  value={kpis.avgCollectionDays !== null ? `${kpis.avgCollectionDays}d` : "—"}
                  icon={Timer}
                  tone="warning"
                />
              </div>
            </section>

            {/* Health summary chips */}
            <section className="rounded-2xl border bg-card shadow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold font-display">Customer Health</h3>
                <span className="text-[11px] text-muted-foreground">{healthSummary.good + healthSummary.avg + healthSummary.risky} total</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-success/10 p-3 text-center">
                  <ShieldCheck className="h-4 w-4 text-success mx-auto mb-1" />
                  <p className="text-xl font-bold font-display text-success tabular-nums">{healthSummary.good}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Good</p>
                </div>
                <div className="rounded-xl bg-warning/10 p-3 text-center">
                  <Shield className="h-4 w-4 text-warning mx-auto mb-1" />
                  <p className="text-xl font-bold font-display text-warning tabular-nums">{healthSummary.avg}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Average</p>
                </div>
                <div className="rounded-xl bg-destructive/10 p-3 text-center">
                  <ShieldAlert className="h-4 w-4 text-destructive mx-auto mb-1" />
                  <p className="text-xl font-bold font-display text-destructive tabular-nums">{healthSummary.risky}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Risky</p>
                </div>
              </div>
            </section>

            {/* Quick actions */}
            <section>
              <h2 className="text-sm font-bold font-display uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</h2>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin -mx-1 px-1">
                {quickLinks.map((q) => (
                  <Link
                    key={q.to}
                    to={q.to}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium shadow-card hover:shadow-elevated hover:border-primary/30 hover:-translate-y-0.5 transition-all"
                  >
                    <q.icon className={`h-4 w-4 ${
                      q.tone === "destructive" ? "text-destructive" :
                      q.tone === "warning" ? "text-warning" :
                      q.tone === "accent" ? "text-accent" :
                      "text-primary"
                    }`} />
                    {q.label}
                  </Link>
                ))}
                <Button
                  variant={showSlowPayers ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setShowSlowPayers(!showSlowPayers); setGlobalSearch(""); }}
                  className="gap-1.5 text-sm h-auto py-2.5 rounded-xl shrink-0"
                >
                  <Timer className="h-4 w-4" />
                  Slow Payers
                </Button>
                <BulkWatiSend invoices={invoices} />
              </div>
            </section>

            {/* Global Search */}
            <section className="relative max-w-xl mx-auto w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search customer, bill no, or mobile..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-11 pr-11 h-12 rounded-2xl border-border bg-card shadow-card text-sm"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </section>

            {searchResults ? (
              <section>
                <h2 className="text-sm font-bold font-display mb-3">
                  Search results <span className="text-muted-foreground font-normal">({searchResults.length})</span>
                </h2>
                <InvoiceTable invoices={searchResults} onPaymentSuccess={() => refetch()} />
              </section>
            ) : showSlowPayers ? (
              <section>
                <h2 className="text-sm font-bold font-display mb-3 flex items-center gap-2">
                  <Timer className="h-4 w-4 text-warning" />
                  Slow Payers <span className="text-muted-foreground font-normal text-xs">(avg &gt; 30 days)</span>
                </h2>
                <InvoiceTable invoices={invoices} onPaymentSuccess={() => refetch()} exportTitle="Slow Payers" defaultSlowPayer />
              </section>
            ) : (
              <>
                <section>
                  <h2 className="text-sm font-bold font-display uppercase tracking-wider text-muted-foreground mb-3">Beats Performance</h2>
                  <BeatChart invoices={invoices} payments={allPayments} />
                </section>
                <TopDefaultersCard invoices={invoices} whatsappLog={whatsappLog} payments={allPayments} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
