import { useMemo } from "react";
import { MapPin, Timer, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import type { Invoice } from "@/lib/invoice";
import { calcAvgCollectionDays } from "@/lib/date-utils";
import type { RecordedPayment } from "@/lib/api";

interface BeatChartProps {
  invoices: Invoice[];
  payments?: RecordedPayment[];
}

const BEAT_COLORS = [
  { bg: "bg-[#DBEAFE]", text: "text-[#1e40af]" },
  { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  { bg: "bg-[#FFEDD5]", text: "text-[#9a3412]" },
  { bg: "bg-[#F3E8FF]", text: "text-[#6b21a8]" },
  { bg: "bg-[#FEE2E2]", text: "text-[#991b1b]" },
  { bg: "bg-[#CFFAFE]", text: "text-[#155e75]" },
  { bg: "bg-[#FEF9C3]", text: "text-[#854d0e]" },
  { bg: "bg-[#FCE7F3]", text: "text-[#9d174d]" },
  { bg: "bg-[#E0E7FF]", text: "text-[#3730a3]" },
  { bg: "bg-[#D1FAE5]", text: "text-[#065f46]" },
  { bg: "bg-[#FED7AA]", text: "text-[#92400e]" },
  { bg: "bg-[#EDE9FE]", text: "text-[#5b21b6]" },
];

export function BeatChart({ invoices, payments = [] }: BeatChartProps) {
  const { beats, totalOutstanding } = useMemo(() => {
    const map = new Map<string, { outstanding: number; customers: Set<string>; count: number; invoices: Invoice[] }>();
    let totalOutstanding = 0;
    for (const inv of invoices) {
      if (!map.has(inv.beat)) map.set(inv.beat, { outstanding: 0, customers: new Set(), count: 0, invoices: [] });
      const entry = map.get(inv.beat)!;
      entry.outstanding += inv.outstandingAmount;
      entry.customers.add(inv.customerName);
      entry.count++;
      entry.invoices.push(inv);
      totalOutstanding += inv.outstandingAmount;
    }
    const beatsRaw = Array.from(map.entries())
      .map(([beat, d]) => {
        const beatPayments = payments.filter(p => d.invoices.some(inv => inv.billNo === p.billNo));
        return {
          beat,
          outstanding: d.outstanding,
          customers: d.customers.size,
          invoiceCount: d.count,
          avgCollectionDays: calcAvgCollectionDays(d.invoices, beatPayments),
          pct: totalOutstanding > 0 ? Math.round((d.outstanding / totalOutstanding) * 100) : 0,
        };
      });
    // Determine top 5 by outstanding
    const sortedByOutstanding = [...beatsRaw].sort((a, b) => b.outstanding - a.outstanding);
    const top5Beats = new Set(sortedByOutstanding.slice(0, 5).map(b => b.beat));
    const beats = beatsRaw
      .map(b => ({ ...b, isTop5: top5Beats.has(b.beat), rank: sortedByOutstanding.findIndex(s => s.beat === b.beat) + 1 }))
      .sort((a, b) => {
        // Show top 5 first, then rest alphabetically
        if (a.isTop5 && !b.isTop5) return -1;
        if (!a.isTop5 && b.isTop5) return 1;
        if (a.isTop5 && b.isTop5) return a.rank - b.rank;
        return a.beat.localeCompare(b.beat);
      });
    return { beats, totalOutstanding };
  }, [invoices, payments]);

  if (beats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
      {beats.map((b, i) => {
        const color = BEAT_COLORS[i % BEAT_COLORS.length];
        const isSlow = b.avgCollectionDays !== null && b.avgCollectionDays > 30;
        return (
          <Link
            key={b.beat}
            to={`/beat/${encodeURIComponent(b.beat)}`}
            className={`rounded-xl p-3 sm:p-4 text-center transition-all hover:scale-[1.03] active:scale-[0.98] shadow-sm ${color.bg} ${color.text} block relative overflow-hidden ${isSlow ? "ring-2 ring-destructive/50" : ""}`}
          >
            {isSlow && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
            )}
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-80 shrink-0" />
              <p className="text-xs sm:text-sm font-bold truncate">{b.beat}</p>
            </div>
            <p className="text-lg sm:text-2xl font-black tracking-tight">
              ₹{b.outstanding.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] sm:text-[11px] opacity-75 mt-0.5">
              {b.customers} cust · {b.invoiceCount} bill{b.invoiceCount !== 1 ? "s" : ""} · <span className="font-semibold">{b.pct}%</span>
            </p>
            {b.avgCollectionDays !== null && (
              <p className={`flex items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-semibold mt-1 ${isSlow ? "text-destructive" : "opacity-80"}`}>
                <Timer className="h-3 w-3" />
                {b.avgCollectionDays}d avg
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
