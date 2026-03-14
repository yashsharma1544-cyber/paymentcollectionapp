import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments } from "@/lib/api";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Brain, Filter, IndianRupee, Loader2, MapPin, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOverdueDays } from "@/lib/date-utils";
import { calculateHealthScore } from "@/lib/health-score";
import { HealthBadge } from "@/components/HealthBadge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Prediction {
  customerName: string;
  likelihood: "High" | "Medium" | "Low";
  reasoning: string;
  suggestedAction: string;
  estimatedAmount: number;
  beat: string;
}

const PaymentPredictions = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [beatFilter, setBeatFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: invoices = [], isLoading: il, refetch, isFetching } = useQuery({
    queryKey: ["invoices"], queryFn: fetchInvoices,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments,
  });

  // Build summary data for AI — include beat info
  const customerSummaries = useMemo(() => {
    const map = new Map<string, { outstanding: number; maxOverdue: number; billCount: number; totalPaid: number; totalBill: number; beat: string }>();
    for (const inv of invoices) {
      if (inv.outstandingAmount <= 0) continue;
      if (!map.has(inv.customerName)) {
        map.set(inv.customerName, { outstanding: 0, maxOverdue: 0, billCount: 0, totalPaid: 0, totalBill: 0, beat: inv.beat || "Unknown" });
      }
      const e = map.get(inv.customerName)!;
      e.outstanding += inv.outstandingAmount;
      e.maxOverdue = Math.max(e.maxOverdue, getOverdueDays(inv.billDate));
      e.billCount++;
      e.totalPaid += inv.paidAmount;
      e.totalBill += inv.billAmount;
      if (!e.beat || e.beat === "Unknown") e.beat = inv.beat || "Unknown";
    }

    const payCountMap = new Map<string, number>();
    for (const p of payments) {
      payCountMap.set(p.customerName, (payCountMap.get(p.customerName) || 0) + 1);
    }

    return Array.from(map.entries()).map(([name, d]) => ({
      name,
      outstanding: d.outstanding,
      maxOverdueDays: d.maxOverdue,
      bills: d.billCount,
      collectionPct: d.totalBill > 0 ? Math.round((d.totalPaid / d.totalBill) * 100) : 0,
      pastPayments: payCountMap.get(name) || 0,
      health: calculateHealthScore(name, invoices, payments).status,
      beat: d.beat,
    }));
  }, [invoices, payments]);

  // All unique beats
  const allBeats = useMemo(() => {
    const beats = new Set(customerSummaries.map(c => c.beat).filter(Boolean));
    return Array.from(beats).sort();
  }, [customerSummaries]);

  const runPredictions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-predictions", {
        body: { customers: customerSummaries.slice(0, 50) },
      });
      if (error) throw error;
      setPredictions(data.predictions || []);
      setHasRun(true);
    } catch (e) {
      toast({ title: "Prediction failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Filtered predictions
  const filteredPredictions = useMemo(() => {
    if (beatFilter === "all") return predictions;
    return predictions.filter(p => p.beat === beatFilter);
  }, [predictions, beatFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const totalPredicted = filteredPredictions.reduce((s, p) => s + p.estimatedAmount, 0);
    const highCount = filteredPredictions.filter(p => p.likelihood === "High").length;
    const highAmount = filteredPredictions.filter(p => p.likelihood === "High").reduce((s, p) => s + p.estimatedAmount, 0);
    const mediumCount = filteredPredictions.filter(p => p.likelihood === "Medium").length;
    const mediumAmount = filteredPredictions.filter(p => p.likelihood === "Medium").reduce((s, p) => s + p.estimatedAmount, 0);
    const lowCount = filteredPredictions.filter(p => p.likelihood === "Low").length;
    const lowAmount = filteredPredictions.filter(p => p.likelihood === "Low").reduce((s, p) => s + p.estimatedAmount, 0);

    return { totalPredicted, highCount, highAmount, mediumCount, mediumAmount, lowCount, lowAmount };
  }, [filteredPredictions]);

  // Beat-wise breakdown
  const beatBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number; high: number; medium: number; low: number }>();
    for (const p of predictions) {
      const beat = p.beat || "Unknown";
      if (!map.has(beat)) map.set(beat, { total: 0, count: 0, high: 0, medium: 0, low: 0 });
      const e = map.get(beat)!;
      e.total += p.estimatedAmount;
      e.count++;
      if (p.likelihood === "High") e.high++;
      else if (p.likelihood === "Medium") e.medium++;
      else e.low++;
    }
    return Array.from(map.entries())
      .map(([beat, d]) => ({ beat, ...d }))
      .sort((a, b) => b.total - a.total);
  }, [predictions]);

  const likelihoodColor = (l: string) => {
    if (l === "High") return "text-success bg-success/10";
    if (l === "Medium") return "text-warning bg-warning/10";
    return "text-destructive bg-destructive/10";
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/"><Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Brain className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">Payment Predictions</h1>
              <p className="text-[11px] text-muted-foreground">AI-powered payment likelihood analysis</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {il ? <Skeleton className="h-96 rounded-xl" /> : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">{customerSummaries.length} customers with outstanding amounts</p>
              <Button onClick={runPredictions} disabled={loading || customerSummaries.length === 0} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Analyzing..." : hasRun ? "Re-analyze" : "Run Predictions"}
              </Button>
            </div>

            {!hasRun && !loading && (
              <Card className="border-dashed border-2 border-primary/30">
                <CardContent className="p-8 text-center space-y-3">
                  <Brain className="h-12 w-12 text-primary/40 mx-auto" />
                  <h3 className="text-sm font-semibold">AI Payment Predictions</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Click "Run Predictions" to analyze customer payment patterns and predict who is most likely to pay this week based on their history, overdue status, and collection patterns.
                  </p>
                </CardContent>
              </Card>
            )}

            {hasRun && predictions.length > 0 && (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Total Predicted</p>
                      <p className="text-xl font-bold text-primary mt-1">{fmt(kpis.totalPredicted)}</p>
                      <p className="text-[10px] text-muted-foreground">{filteredPredictions.length} customers</p>
                    </CardContent>
                  </Card>
                  <Card className="border-success/30">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-success uppercase tracking-wide font-medium">High Likelihood</p>
                      <p className="text-xl font-bold text-success mt-1">{fmt(kpis.highAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">{kpis.highCount} customers</p>
                    </CardContent>
                  </Card>
                  <Card className="border-warning/30">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-warning uppercase tracking-wide font-medium">Medium Likelihood</p>
                      <p className="text-xl font-bold text-warning mt-1">{fmt(kpis.mediumAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">{kpis.mediumCount} customers</p>
                    </CardContent>
                  </Card>
                  <Card className="border-destructive/30">
                    <CardContent className="p-4">
                      <p className="text-[10px] text-destructive uppercase tracking-wide font-medium">Low Likelihood</p>
                      <p className="text-xl font-bold text-destructive mt-1">{fmt(kpis.lowAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">{kpis.lowCount} customers</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Beat-wise Breakdown */}
                {beatBreakdown.length > 1 && (
                  <Card>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> Beat-wise Predicted Collection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="space-y-2">
                        {beatBreakdown.map(b => {
                          const maxTotal = beatBreakdown[0]?.total || 1;
                          const pct = Math.round((b.total / maxTotal) * 100);
                          return (
                            <div key={b.beat} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <button
                                  onClick={() => setBeatFilter(beatFilter === b.beat ? "all" : b.beat)}
                                  className={`font-medium hover:text-primary transition-colors ${beatFilter === b.beat ? "text-primary underline" : ""}`}
                                >
                                  {b.beat}
                                </button>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{fmt(b.total)}</span>
                                  <span className="text-muted-foreground text-[10px]">
                                    {b.high}H · {b.medium}M · {b.low}L
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Beat Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={beatFilter} onValueChange={setBeatFilter}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Filter by beat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Beats</SelectItem>
                      {allBeats.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {beatFilter !== "all" && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setBeatFilter("all")}>Clear</Button>
                  )}
                </div>

                {/* Prediction Cards */}
                <div className="space-y-3">
                  {filteredPredictions.map((pred, i) => {
                    const health = calculateHealthScore(pred.customerName, invoices, payments);
                    return (
                      <Card key={pred.customerName} className="border shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                              <Link to={`/customer/${encodeURIComponent(pred.customerName)}`} className="text-sm font-semibold hover:underline text-primary truncate">
                                {pred.customerName}
                              </Link>
                              <HealthBadge status={health.status} size="sm" showLabel={false} />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${likelihoodColor(pred.likelihood)}`}>
                                {pred.likelihood}
                              </span>
                              {pred.estimatedAmount > 0 && (
                                <span className="text-xs font-bold text-success">~{fmt(pred.estimatedAmount)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {pred.beat && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                                <MapPin className="h-2.5 w-2.5 mr-0.5" />{pred.beat}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{pred.reasoning}</p>
                          <p className="text-[11px] font-medium text-primary">💡 {pred.suggestedAction}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {filteredPredictions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No predictions for this beat.</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PaymentPredictions;
