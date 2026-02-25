import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import type { Invoice } from "@/lib/invoice";

interface BeatChartProps {
  invoices: Invoice[];
}

export function BeatChart({ invoices }: BeatChartProps) {
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
      {beats.map((b) => (
        <Card key={b.beat} className="border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <MapPin className="h-3.5 w-3.5 text-primary" />
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
      ))}
    </div>
  );
}
