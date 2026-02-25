import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Invoice } from "@/lib/invoice";

interface BeatChartProps {
  invoices: Invoice[];
}

const COLORS = [
  "hsl(0, 72%, 55%)",
  "hsl(217, 72%, 48%)",
  "hsl(38, 92%, 50%)",
  "hsl(152, 55%, 42%)",
  "hsl(280, 60%, 50%)",
  "hsl(340, 70%, 52%)",
  "hsl(190, 70%, 42%)",
  "hsl(25, 80%, 50%)",
];

export function BeatChart({ invoices }: BeatChartProps) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      map.set(inv.beat, (map.get(inv.beat) || 0) + inv.outstandingAmount);
    }
    return Array.from(map.entries())
      .map(([beat, outstanding]) => ({ beat, outstanding }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices]);

  if (data.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold font-['Space_Grotesk']">
          Outstanding by Beat
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <XAxis
              type="number"
              tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
              fontSize={11}
              stroke="hsl(220, 10%, 50%)"
            />
            <YAxis
              dataKey="beat"
              type="category"
              width={100}
              fontSize={11}
              stroke="hsl(220, 10%, 50%)"
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Outstanding"]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(220, 16%, 88%)",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="outstanding" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
