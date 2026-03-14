import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Pencil, Check, Trophy } from "lucide-react";
import type { RecordedPayment } from "@/lib/api";

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
      <Card className="border-dashed border-2 border-primary/30 shadow-sm">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Set a daily collection target</span>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEditing(true)}>
            Set Target
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-0 shadow-sm overflow-hidden ${isAchieved ? "bg-success/10 ring-2 ring-success/30" : "bg-primary/5"}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAchieved ? <Trophy className="h-4 w-4 text-success" /> : <Target className="h-4 w-4 text-primary" />}
            <span className="text-xs font-semibold">
              {isAchieved ? "🎉 Target Achieved!" : "Daily Target"}
            </span>
          </div>
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="₹ Amount"
                className="h-7 w-24 text-xs"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveTarget()}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveTarget}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(true); setInputVal(String(target)); }}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-black leading-tight">
              ₹{collected.toLocaleString("en-IN")}
              <span className="text-xs font-normal text-muted-foreground"> / ₹{target.toLocaleString("en-IN")}</span>
            </p>
          </div>
          <span className={`text-sm font-bold ${isAchieved ? "text-success" : pct >= 75 ? "text-primary" : "text-muted-foreground"}`}>
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isAchieved ? "bg-success" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
