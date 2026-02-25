import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, AlertTriangle, CheckCircle, Users, MapPin } from "lucide-react";
import type { Invoice } from "@/lib/invoice";
import { useMemo } from "react";

interface StatsCardsProps {
  invoices: Invoice[];
}

export function StatsCards({ invoices }: StatsCardsProps) {
  const stats = useMemo(() => {
    const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalBill = invoices.reduce((s, i) => s + i.billAmount, 0);
    const uniqueCustomers = new Set(invoices.map((i) => i.customerName)).size;
    const uniqueBeats = new Set(invoices.map((i) => i.beat)).size;
    const overdueCount = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).length;

    return { totalOutstanding, totalPaid, totalBill, uniqueCustomers, uniqueBeats, overdueCount };
  }, [invoices]);

  const cards = [
    {
      label: "Total Outstanding",
      value: `₹${stats.totalOutstanding.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Total Collected",
      value: `₹${stats.totalPaid.toLocaleString("en-IN")}`,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Customers",
      value: stats.uniqueCustomers.toString(),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Beats",
      value: stats.uniqueBeats.toString(),
      sub: `${stats.overdueCount} overdue`,
      icon: MapPin,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((stat) => (
        <Card key={stat.label} className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              <p className="text-lg font-bold font-['Space_Grotesk'] tracking-tight leading-tight">
                {stat.value}
              </p>
              {"sub" in stat && stat.sub && (
                <p className="text-xs text-destructive">{stat.sub}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
