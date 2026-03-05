import { useMemo } from "react";
import { MapPin, Timer } from "lucide-react";
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
  const beats = useMemo(() => {
    const map = new Map<string, { outstanding: number; customers: Set<string>; count: number; invoices: Invoice[] }>();
    for (const inv of invoices) {
      if (!map.has(inv.beat)) map.set(inv.beat, { outstanding: 0, customers: new Set(), count: 0, invoices: [] });
      const entry = map.get(inv.beat)!;
      entry.outstanding += inv.outstandingAmount;
      entry.customers.add(inv.customerName);
      entry.count++;
      entry.invoices.push(inv);
    }
    return Array.from(map.entries())
      .map(([beat, d]) => {
        const beatPayments = payments.filter(p => d.invoices.some(inv => inv.billNo === p.billNo));
        return {
          beat,
          outstanding: d.outstanding,
          customers: d.customers.size,
          invoiceCount: d.count,
          avgCollectionDays: calcAvgCollectionDays(d.invoices, beatPayments),
        };
      })
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices, payments]);

  if (beats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
      {beats.map((b, i) => {
        const color = BEAT_COLORS[i % BEAT_COLORS.length];
        return (
          <Link
            key={b.beat}
            to={`/beat/${encodeURIComponent(b.beat)}`}
            className={`rounded-xl p-3 sm:p-4 text-center transition-all hover:scale-[1.03] active:scale-[0.98] shadow-sm ${color.bg} ${color.text} block`}
          >
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-80 shrink-0" />
              <p className="text-xs sm:text-sm font-bold truncate">{b.beat}</p>
            </div>
            <p className="text-lg sm:text-2xl font-black tracking-tight">
              ₹{b.outstanding.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] sm:text-[11px] opacity-75 mt-0.5">
              {b.customers} cust · {b.invoiceCount} bill{b.invoiceCount !== 1 ? "s" : ""}
            </p>
            {b.avgCollectionDays !== null && (
              <p className="flex items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-semibold opacity-80 mt-1">
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
