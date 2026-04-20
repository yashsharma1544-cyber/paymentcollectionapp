import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, AlertCircle, MessageCircle, Target } from "lucide-react";
import { getCustomerInsight, getProvider, setProvider, type CustomerInsight, type AiProvider } from "@/lib/ai-insights";
import { AiProviderPicker } from "@/components/AiProviderPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerName: string;
}

export function CustomerInsightDialog({ open, onOpenChange, customerName }: Props) {
  const [insight, setInsight] = useState<CustomerInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [provider, setProviderState] = useState<AiProvider>(() => getProvider());

  const load = async (force = false, prov?: AiProvider) => {
    if (!customerName) return;
    setLoading(true);
    setError(null);
    setMissingKey(false);
    try {
      const data = await getCustomerInsight(customerName, force, prov || provider);
      setInsight(data);
    } catch (e: any) {
      if (e?.code === "MISSING_KEY") setMissingKey(true);
      else setError(e?.error || "Could not load insight");
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (p: AiProvider) => {
    setProviderState(p);
    setProvider(p);
    load(false, p);
  };

  useEffect(() => {
    if (open && customerName) {
      setInsight(null);
      load(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerName]);

  const riskColor = insight?.risk === "high"
    ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
    : insight?.risk === "medium"
    ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="truncate">{customerName}</span>
          </DialogTitle>
          <DialogDescription className="text-left">AI insight on this customer's payment behavior</DialogDescription>
        </DialogHeader>

        {missingKey && (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">
            ✨ AI not configured yet. Add your <code className="text-xs">ANTHROPIC_API_KEY</code> to enable insights.
          </div>
        )}

        {error && !missingKey && (
          <div className="flex items-start gap-2 text-sm bg-destructive/10 text-destructive rounded-md p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div>{error}</div>
              <Button size="sm" variant="outline" className="mt-2 h-7" onClick={() => load(false)}>Retry</Button>
            </div>
          </div>
        )}

        {loading && !insight && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {insight && !error && !missingKey && (
          <div className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-base leading-snug flex-1">{insight.headline}</div>
              <Badge variant="outline" className={`${riskColor} uppercase text-[10px] tracking-wider`}>
                {insight.risk} risk
              </Badge>
            </div>

            {insight.risk_reason && (
              <div className="text-xs text-muted-foreground italic">{insight.risk_reason}</div>
            )}

            {insight.behavior && (
              <div>
                <div className="text-xs font-semibold text-foreground/70 mb-1">Behavior</div>
                <div className="text-foreground/90 leading-relaxed">{insight.behavior}</div>
              </div>
            )}

            {insight.recommendations?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70 mb-1.5">
                  <Target className="h-3.5 w-3.5 text-orange-500" />
                  Recommendations
                </div>
                <ul className="space-y-1.5">
                  {insight.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 leading-snug">
                      <span className="text-muted-foreground">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insight.talking_points?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70 mb-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                  Talking points
                </div>
                <ul className="space-y-1.5">
                  {insight.talking_points.map((t, i) => (
                    <li key={i} className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-2 leading-snug border border-blue-100 dark:border-blue-900/40">
                      "{t}"
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t gap-2">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-8" onClick={() => load(true)} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <AiProviderPicker value={provider} onChange={handleProviderChange} disabled={loading} />
              </div>
              <div className="text-[10px] text-muted-foreground text-right">
                {insight._cached ? "Cached" : "Fresh"}
                {insight._provider && ` · ${insight._provider}`}
                {insight._generated_at && <div>{new Date(insight._generated_at).toLocaleString("en-IN")}</div>}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
