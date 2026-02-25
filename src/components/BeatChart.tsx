import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import type { Invoice } from "@/lib/invoice";

interface BeatChartProps {
  invoices: Invoice[];
  selectedBeat: string | null;
  onSelectBeat: (beat: string | null) => void;
}

const BEAT_COLORS = [
  { bg: "bg-[hsl(217,72%,48%)]/12", border: "border-[hsl(217,72%,48%)]/40", icon: "text-[hsl(217,72%,48%)]", activeBg: "bg-[hsl(217,72%,48%)]/20" },
  { bg: "bg-[hsl(152,55%,42%)]/12", border: "border-[hsl(152,55%,42%)]/40", icon: "text-[hsl(152,55%,42%)]", activeBg: "bg-[hsl(152,55%,42%)]/20" },
  { bg: "bg-[hsl(38,92%,50%)]/12", border: "border-[hsl(38,92%,50%)]/40", icon: "text-[hsl(38,92%,50%)]", activeBg: "bg-[hsl(38,92%,50%)]/20" },
  { bg: "bg-[hsl(340,70%,52%)]/12", border: "border-[hsl(340,70%,52%)]/40", icon: "text-[hsl(340,70%,52%)]", activeBg: "bg-[hsl(340,70%,52%)]/20" },
  { bg: "bg-[hsl(280,60%,50%)]/12", border: "border-[hsl(280,60%,50%)]/40", icon: "text-[hsl(280,60%,50%)]", activeBg: "bg-[hsl(280,60%,50%)]/20" },
  { bg: "bg-[hsl(190,70%,42%)]/12", border: "border-[hsl(190,70%,42%)]/40", icon: "text-[hsl(190,70%,42%)]", activeBg: "bg-[hsl(190,70%,42%)]/20" },
  { bg: "bg-[hsl(25,80%,50%)]/12", border: "border-[hsl(25,80%,50%)]/40", icon: "text-[hsl(25,80%,50%)]", activeBg: "bg-[hsl(25,80%,50%)]/20" },
  { bg: "bg-[hsl(0,72%,55%)]/12", border: "border-[hsl(0,72%,55%)]/40", icon: "text-[hsl(0,72%,55%)]", activeBg: "bg-[hsl(0,72%,55%)]/20" },
  { bg: "bg-[hsl(160,50%,38%)]/12", border: "border-[hsl(160,50%,38%)]/40", icon: "text-[hsl(160,50%,38%)]", activeBg: "bg-[hsl(160,50%,38%)]/20" },
  { bg: "bg-[hsl(260,45%,55%)]/12", border: "border-[hsl(260,45%,55%)]/40", icon: "text-[hsl(260,45%,55%)]", activeBg: "bg-[hsl(260,45%,55%)]/20" },
];

export function BeatChart({ invoices, selectedBeat, onSelectBeat }: BeatChartProps) {
  const beats = useMemo(() => {
    const map = new Map<string, { outstanding: number; customers: Set<string>; count: number }>();
    for (const inv of invoices) {
      if (!map.has(inv.beat)) map.set(inv.beat, { outstanding: 0, customers: new Set(), count: 0 });
      const entry = map.get(inv.beat)!;
      entry.outstanding += inv.outstandingAmount;
      entry.customers.add(inv.customerName);
      entry.count++;
    }
    return Array.from(map.entries())
      .map(([beat, d]) => ({ beat, outstanding: d.outstanding, customers: d.customers.size, invoices: d.count }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices]);

  if (beats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {beats.map((b, i) => {
        const color = BEAT_COLORS[i % BEAT_COLORS.length];
        const isActive = selectedBeat === b.beat;
        return (
          <Card
            key={b.beat}
            onClick={() => onSelectBeat(isActive ? null : b.beat)}
            className={`border shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${color.border} ${isActive ? `${color.activeBg} ring-2 ring-offset-1 ring-current ${color.icon}` : ""}`}
          >
            <CardContent className={`p-3 ${color.bg} rounded-[inherit]`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${color.bg}`}>
                  <MapPin className={`h-3.5 w-3.5 ${color.icon}`} />
                </div>
                <p className="text-xs font-semibold truncate">{b.beat}</p>
              </div>
              <p className="text-base font-bold font-['Space_Grotesk'] text-destructive">
                ₹{b.outstanding.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {b.customers} customer{b.customers !== 1 ? "s" : ""} · {b.invoices} bill{b.invoices !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
