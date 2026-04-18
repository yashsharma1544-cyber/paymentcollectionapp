import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1280px)").matches,
  );

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
    <div className="relative rounded-2xl overflow-hidden shadow-card">
      {/* Gradient border */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-accent to-primary-glow opacity-90" aria-hidden />
      <div className="relative m-[1.5px] rounded-2xl bg-card">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-display leading-tight">Daily AI Brief</h2>
                <p className="text-[11px] text-muted-foreground">Your personalised priorities</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => load(true)}
                disabled={loading}
                title="Refresh brief"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
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
                <div className="text-sm text-muted-foreground bg-muted/60 rounded-xl p-3">
                  ✨ AI not configured yet. Add your <code className="text-xs font-mono bg-background px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> to enable daily briefs.
                </div>
              )}

              {error && !missingKey && (
                <div className="flex items-start gap-2 text-sm bg-destructive/10 text-destructive rounded-xl p-3">
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
                    <div className="font-semibold text-foreground leading-snug text-base">{brief.headline}</div>
                  )}

                  {brief.priorities?.length > 0 && (
                    <Section icon={<Target className="h-4 w-4 text-warning" />} label="Priorities" items={brief.priorities} />
                  )}
                  {brief.opportunities?.length > 0 && (
                    <Section icon={<TrendingUp className="h-4 w-4 text-success" />} label="Opportunities" items={brief.opportunities} />
                  )}
                  {brief.warnings?.length > 0 && (
                    <Section icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Warnings" items={brief.warnings} />
                  )}

                  {brief.metrics_note && (
                    <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5 border flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{brief.metrics_note}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground pt-1 flex justify-between">
                    <span className="inline-flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${brief._cached ? "bg-muted-foreground" : "bg-success animate-pulse"}`} />
                      {brief._cached ? "Cached" : "Fresh"}
                    </span>
                    {brief._generated_at && <span>{new Date(brief._generated_at).toLocaleString("en-IN")}</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, label, items }: { icon: React.ReactNode; label: string; items: string[] }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/80 mb-1.5">
        {icon}
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-2">
            <span className="text-primary mt-1">•</span>
            <span className="flex-1">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
