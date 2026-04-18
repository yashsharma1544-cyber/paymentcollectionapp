import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments, fetchWhatsAppLog } from "@/lib/api";
import { BeatChart } from "@/components/BeatChart";
import { InvoiceTable } from "@/components/InvoiceTable";
import {
  IndianRupee, Users, TrendingUp, CalendarClock, AlertTriangle, ClipboardList,
  Timer, ArrowLeft, Brain, Route, BarChart3, ShieldCheck, Shield, ShieldAlert,
  Star, History, Percent, ChevronRight, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const fmtCompact = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const Index = () => {
  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ["invoices"], queryFn: fetchInvoices,
  });
  const { data: allPayments = [] } = useQuery({
    queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments,
  });
  const { data: whatsappLog = [] } = useQuery({
    queryKey: ["whatsapp-log"], queryFn: fetchWhatsAppLog,
  });

  const [showSlowPayers, setShowSlowPayers] = useState(false);
  const { currentUser } = useUser();

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

  const kpiInvoices = useMemo(
    () => (showSlowPayers ? invoices.filter(i => slowPayerCustomers.has(i.customerName)) : invoices),
    [invoices, showSlowPayers, slowPayerCustomers],
  );
  const kpiPayments = useMemo(
    () => (showSlowPayers ? allPayments.filter(p => slowPayerCustomers.has(p.customerName)) : allPayments),
    [allPayments, showSlowPayers, slowPayerCustomers],
  );

  const kpis = useMemo(() => {
    const totalOutstanding = kpiInvoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalBill = kpiInvoices.reduce((s, i) => s + i.billAmount, 0);
    const totalPaid = kpiInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const customers = new Set(kpiInvoices.map((i) => i.customerName)).size;
    const overdueOutstanding = kpiInvoices
      .filter((i) => getOverdueDays(i.billDate) > 0 && i.outstandingAmount > 0)
      .reduce((s, i) => s + i.outstandingAmount, 0);
    const overdueRatio = totalOutstanding > 0 ? Math.round((overdueOutstanding / totalOutstanding) * 100) : 0;
    const collectionRate = totalBill > 0 ? Math.round((totalPaid / totalBill) * 100) : 0;
    const avgCollectionDays = calcAvgCollectionDays(kpiInvoices, kpiPayments);
    const dueSoonCount = kpiInvoices.filter(i => {
      const od = getOverdueDays(i.billDate);
      return od >= -3 && od <= 0 && i.outstandingAmount > 0;
    }).length;
    return {
      totalOutstanding, totalPaid, totalBill, customers, overdueOutstanding,
      overdueRatio, collectionRate, avgCollectionDays, dueSoonCount,
    };
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

  const quickLinks = [
    { to: "/due-today", label: "Due Today", icon: CalendarClock },
    { to: "/defaulters", label: "Defaulters", icon: AlertTriangle },
    { to: "/focus", label: "Focus", icon: Star },
    { to: "/crm", label: "CRM", icon: Users },
    { to: "/predictions", label: "AI Predict", icon: Brain },
    { to: "/route-planner", label: "Routes", icon: Route },
    { to: "/daily-report", label: "Daily Report", icon: ClipboardList },
    { to: "/monthly-report", label: "Monthly", icon: BarChart3 },
    { to: "/payments", label: "Payments Log", icon: History },
  ];

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center max-w-md mx-auto">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <p className="font-bold mb-1">Failed to load data</p>
        <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-[1400px] mx-auto">
        <Skeleton className="h-28 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Hero greeting + headline outstanding */}
      <section className="rounded-xl border bg-gradient-brand text-brand-navy-foreground p-5 sm:p-6 shadow-elevated overflow-hidden relative">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-white/60">{greeting()}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight mt-1 text-white truncate">
              {currentUser}
            </h1>
            <p className="text-sm text-white/70 mt-2 max-w-md">
              Managing <span className="font-semibold text-white tabular-nums">{kpis.customers}</span> customers ·{" "}
              <span className="font-semibold text-white tabular-nums">{kpis.dueSoonCount}</span> invoices due in 3 days
            </p>
          </div>
          <div className="flex items-end justify-between sm:flex-col sm:items-end gap-2 sm:gap-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/60 font-bold">Total Outstanding</p>
            <p className="text-3xl sm:text-4xl font-extrabold font-display tabular-nums text-white leading-none">
              {fmtCompact(kpis.totalOutstanding)}
            </p>
            <p className="text-[11px] text-white/70 mt-1">
              {kpis.overdueRatio}% overdue · {fmtCompact(kpis.overdueOutstanding)}
            </p>
          </div>
        </div>
      </section>

      {/* KPI Grid */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-eyebrow">Key Metrics</h2>
          {showSlowPayers && (
            <Button variant="ghost" size="sm" onClick={() => setShowSlowPayers(false)} className="gap-1.5 text-xs h-8">
              <ArrowLeft className="h-3.5 w-3.5" /> Show all
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Outstanding"
            value={fmtCompact(kpis.totalOutstanding)}
            icon={IndianRupee}
            tone="destructive"
            emphasis
          />
          <StatCard
            label="Collected"
            value={fmtCompact(kpis.totalPaid)}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Collection %"
            value={`${kpis.collectionRate}%`}
            icon={Percent}
            tone="brand"
            sub={`of ₹${(kpis.totalBill / 100000).toFixed(1)}L billed`}
          />
          <StatCard
            label="DSO (Avg Days)"
            value={kpis.avgCollectionDays !== null ? `${kpis.avgCollectionDays}d` : "—"}
            icon={Activity}
            tone="warning"
            sub="Days Sales Outstanding"
          />
          <StatCard
            label="Overdue"
            value={fmtCompact(kpis.overdueOutstanding)}
            icon={AlertTriangle}
            tone="warning"
            sub={`${kpis.overdueRatio}% of total`}
            to="/defaulters"
          />
          <StatCard
            label="Customers"
            value={kpis.customers}
            icon={Users}
            tone="muted"
          />
        </div>
      </section>

      {/* Two-column layout: main content + AI brief sidebar */}
      <div className="grid xl:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-6 min-w-0">
          {/* Daily Target */}
          <DailyTarget todayPayments={todayPayments} />

          {/* Quick Actions — moved above Beats */}
          <section>
            <h2 className="section-eyebrow mb-3">Quick Actions</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin -mx-1 px-1">
              {quickLinks.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="shrink-0 inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold shadow-soft hover:border-primary/40 hover:text-primary transition-all"
                >
                  <q.icon className="h-4 w-4" />
                  {q.label}
                </Link>
              ))}
              <Button
                variant={showSlowPayers ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSlowPayers(!showSlowPayers)}
                className="gap-1.5 text-sm h-auto py-2 rounded-md shrink-0 font-semibold"
              >
                <Timer className="h-4 w-4" />
                Slow Payers
              </Button>
              <BulkWatiSend invoices={invoices} />
            </div>
          </section>

          {showSlowPayers ? (
            <section>
              <h2 className="text-base font-bold font-display mb-3 flex items-center gap-2">
                <Timer className="h-4 w-4 text-warning" />
                Slow Payers <span className="text-muted-foreground font-normal text-xs">(avg &gt; 30 days)</span>
              </h2>
              <InvoiceTable invoices={invoices} onPaymentSuccess={() => refetch()} exportTitle="Slow Payers" defaultSlowPayer />
            </section>
          ) : (
            <>
              {/* Beat Performance */}
              <section>
                <h2 className="section-eyebrow mb-3">Beat Performance</h2>
                <BeatChart invoices={invoices} payments={allPayments} />
              </section>

              {/* Customer Health */}
              <section className="rounded-lg border bg-card shadow-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold font-display">Customer Health</h3>
                    <p className="text-[11px] text-muted-foreground">{healthSummary.good + healthSummary.avg + healthSummary.risky} active accounts</p>
                  </div>
                  <Link to="/crm" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    View CRM <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { icon: ShieldCheck, label: "Good", count: healthSummary.good, color: "success" },
                    { icon: Shield, label: "Average", count: healthSummary.avg, color: "warning" },
                    { icon: ShieldAlert, label: "Risky", count: healthSummary.risky, color: "destructive" },
                  ].map((h) => (
                    <div key={h.label} className={`rounded-md border p-3 sm:p-4 bg-${h.color}/5 border-${h.color}/20`}>
                      <h.icon className={`h-4 w-4 text-${h.color} mb-2`} />
                      <p className={`text-2xl sm:text-3xl font-extrabold font-display text-${h.color} tabular-nums leading-none`}>{h.count}</p>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-bold mt-1.5">{h.label}</p>
                    </div>
                  ))}
                </div>
              </section>

              <TopDefaultersCard invoices={invoices} whatsappLog={whatsappLog} payments={allPayments} />
            </>
          )}
        </div>

        {/* Right sidebar: Daily AI Brief (sticky on desktop) */}
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <DailyBriefCard />
        </aside>
      </div>
    </div>
  );
};

export default Index;
