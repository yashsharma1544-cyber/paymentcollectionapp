import { useMemo } from "react";
import { MapPin } from "lucide-react";
import type { Invoice } from "@/lib/invoice";

interface BeatChartProps {
  invoices: Invoice[];
  selectedBeat: string | null;
  onSelectBeat: (beat: string | null) => void;
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
          <button
            key={b.beat}
            onClick={() => onSelectBeat(isActive ? null : b.beat)}
            className={`rounded-xl p-4 text-center transition-all hover:scale-[1.03] active:scale-[0.98] ${color.bg} ${color.text} ${isActive ? "ring-3 ring-offset-2 ring-foreground/40 shadow-lg" : "shadow-sm"}`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <MapPin className="h-4 w-4 opacity-80" />
              <p className="text-sm font-bold truncate">{b.beat}</p>
            </div>
            <p className="text-2xl font-black tracking-tight">
              ₹{b.outstanding.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] opacity-75 mt-1">
              {b.customers} customer{b.customers !== 1 ? "s" : ""} · {b.invoices} bill{b.invoices !== 1 ? "s" : ""}
            </p>
          </button>
        );
      })}
    </div>
  );
}
