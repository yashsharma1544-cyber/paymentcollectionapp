import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, AlertTriangle, Target, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDailyBrief, type DailyBrief } from "@/lib/ai-insights";
import { useUser } from "@/contexts/UserContext";

export function DailyBriefCard() {
  const { currentUser } = useUser();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [open, setOpen] = useState(true);

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    setMissingKey(false);
    try {
      const data = await getDailyBrief(currentUser || "Team", force);
      setBrief(data);
    } catch (e: any) {
      if (e?.code === "MISSING_KEY") setMissingKey(true);
      else setError(e?.error || "Could not load daily brief");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  return (
    <Card className="mb-4 overflow-hidden border-0 shadow-md bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-950/30 dark:via-background dark:to-purple-950/30">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-base sm:text-lg font-semibold">Daily AI Brief</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => load(true)}
              disabled={loading}
              title="Refresh brief"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setOpen((o) => !o)}
              title={open ? "Collapse" : "Expand"}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {open && (
          <>
            {missingKey && (
              <div className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">
                ✨ AI not configured yet. Add your <code className="text-xs">ANTHROPIC_API_KEY</code> to enable daily briefs.
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

            {loading && !brief && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {brief && !error && !missingKey && (
              <div className="space-y-3 text-sm">
                {brief.greeting && (
                  <div className="text-muted-foreground italic">{brief.greeting}</div>
                )}
                {brief.headline && (
                  <div className="font-medium text-foreground leading-snug">{brief.headline}</div>
                )}

                {brief.priorities?.length > 0 && (
                  <Section icon={<Target className="h-4 w-4 text-orange-500" />} label="Priorities" items={brief.priorities} />
                )}
                {brief.opportunities?.length > 0 && (
                  <Section icon={<TrendingUp className="h-4 w-4 text-green-600" />} label="Opportunities" items={brief.opportunities} />
                )}
                {brief.warnings?.length > 0 && (
                  <Section icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Warnings" items={brief.warnings} />
                )}

                {brief.metrics_note && (
                  <div className="text-xs text-muted-foreground bg-white/60 dark:bg-background/40 rounded p-2 border">
                    <CheckCircle2 className="h-3 w-3 inline mr-1 text-blue-500" />
                    {brief.metrics_note}
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground pt-1 flex justify-between">
                  <span>{brief._cached ? "Cached" : "Fresh"}</span>
                  {brief._generated_at && <span>{new Date(brief._generated_at).toLocaleString("en-IN")}</span>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function Section({ icon, label, items }: { icon: React.ReactNode; label: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80 mb-1">
        {icon}
        {label}
      </div>
      <ul className="space-y-1 ml-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-1.5">
            <span className="text-muted-foreground">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
