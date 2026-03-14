import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, fetchRecordedPayments } from "@/lib/api";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Brain, IndianRupee, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOverdueDays } from "@/lib/date-utils";
import { calculateHealthScore } from "@/lib/health-score";
import { HealthBadge } from "@/components/HealthBadge";
import { useToast } from "@/hooks/use-toast";

interface Prediction {
  customerName: string;
  likelihood: "High" | "Medium" | "Low";
  reasoning: string;
  suggestedAction: string;
  estimatedAmount: number;
}

const PaymentPredictions = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const { toast } = useToast();

  const { data: invoices = [], isLoading: il, refetch, isFetching } = useQuery({
    queryKey: ["invoices"], queryFn: fetchInvoices,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["recorded-payments"], queryFn: fetchRecordedPayments,
  });

  // Build summary data for AI
  const customerSummaries = useMemo(() => {
    const map = new Map<string, { outstanding: number; maxOverdue: number; billCount: number; avgCollectionDays: number | null; totalPaid: number; totalBill: number }>();
    for (const inv of invoices) {
      if (inv.outstandingAmount <= 0) continue;
      if (!map.has(inv.customerName)) {
        map.set(inv.customerName, { outstanding: 0, maxOverdue: 0, billCount: 0, avgCollectionDays: null, totalPaid: 0, totalBill: 0 });
      }
      const e = map.get(inv.customerName)!;
      e.outstanding += inv.outstandingAmount;
      e.maxOverdue = Math.max(e.maxOverdue, getOverdueDays(inv.billDate));
      e.billCount++;
      e.totalPaid += inv.paidAmount;
      e.totalBill += inv.billAmount;
    }

    // Add payment history count
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
    }));
  }, [invoices, payments]);

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

  const likelihoodColor = (l: string) => {
    if (l === "High") return "text-success bg-success/10";
    if (l === "Medium") return "text-warning bg-warning/10";
    return "text-destructive bg-destructive/10";
  };

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
            <div className="flex items-center justify-between">
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

            {predictions.length > 0 && (
              <div className="space-y-3">
                {predictions.map((pred, i) => {
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
                              {pred.likelihood} Likelihood
                            </span>
                            {pred.estimatedAmount > 0 && (
                              <span className="text-xs font-bold text-success">~₹{pred.estimatedAmount.toLocaleString("en-IN")}</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{pred.reasoning}</p>
                        <p className="text-[11px] font-medium text-primary">💡 {pred.suggestedAction}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PaymentPredictions;
