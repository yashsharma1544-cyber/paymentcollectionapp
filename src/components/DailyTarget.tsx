import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Pencil, Check, Trophy } from "lucide-react";
import type { RecordedPayment } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DailyTargetProps {
  todayPayments: RecordedPayment[];
}

const STORAGE_KEY = "daily-collection-target";

export function DailyTarget({ todayPayments }: DailyTargetProps) {
  const [target, setTarget] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const collected = useMemo(
    () => todayPayments.reduce((s, p) => s + p.paidAmount, 0),
    [todayPayments]
  );

  const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
  const isAchieved = target > 0 && collected >= target;

  const saveTarget = () => {
    const val = parseInt(inputVal.replace(/[₹,]/g, ""), 10);
    if (!isNaN(val) && val > 0) {
      setTarget(val);
      localStorage.setItem(STORAGE_KEY, String(val));
    }
    setEditing(false);
    setInputVal("");
  };

  if (target === 0 && !editing) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="text-sm font-semibold">Set your daily target</p>
            <p className="text-[11px] text-muted-foreground">Track today's collection goal</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setEditing(true)} className="bg-gradient-primary">
          Set Target
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5 shadow-card overflow-hidden relative",
        isAchieved
          ? "bg-gradient-success text-success-foreground border-success/30"
          : "bg-card",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isAchieved ? (
            <Trophy className="h-4 w-4" />
          ) : (
            <Target className="h-4 w-4 text-primary" />
          )}
          <span className={cn("text-xs font-semibold uppercase tracking-wider", isAchieved ? "" : "text-muted-foreground")}>
            {isAchieved ? "🎉 Target Achieved" : "Daily Target"}
          </span>
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="₹ Amount"
              className="h-8 w-28 text-xs"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveTarget()}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveTarget}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => { setEditing(true); setInputVal(String(target)); }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isAchieved ? "hover:bg-white/20" : "hover:bg-muted",
            )}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className={cn("text-2xl sm:text-3xl font-bold font-display tabular-nums leading-none", isAchieved ? "" : "text-foreground")}>
            ₹{collected.toLocaleString("en-IN")}
          </p>
          <p className={cn("text-xs mt-1", isAchieved ? "opacity-90" : "text-muted-foreground")}>
            of ₹{target.toLocaleString("en-IN")} goal
          </p>
        </div>
        <span
          className={cn(
            "text-2xl font-bold font-display tabular-nums",
            isAchieved ? "" : pct >= 75 ? "text-primary" : "text-muted-foreground",
          )}
        >
          {pct}%
        </span>
      </div>

      <div
        className={cn(
          "h-2.5 rounded-full overflow-hidden",
          isAchieved ? "bg-white/20" : "bg-muted",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isAchieved ? "bg-white" : "bg-gradient-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
