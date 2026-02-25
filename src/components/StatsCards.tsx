import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { Invoice } from "@/lib/invoice";

interface StatsCardsProps {
  invoices: Invoice[];
}

export function StatsCards({ invoices }: StatsCardsProps) {
  const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const pendingCount = invoices.filter(
    (i) => i.paymentStatus.toLowerCase() === "pending"
  ).length;
  const overdueCount = invoices.filter((i) => i.daysOverdue > 0 && i.outstandingAmount > 0).length;

  const stats = [
    {
      label: "Total Outstanding",
      value: `₹${totalOutstanding.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Total Collected",
      value: `₹${totalPaid.toLocaleString("en-IN")}`,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Pending Invoices",
      value: pendingCount.toString(),
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Overdue",
      value: overdueCount.toString(),
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold font-['Space_Grotesk'] tracking-tight">
                {stat.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
