import type { Invoice } from "@/lib/invoice";
import type { RecordedPayment } from "@/lib/api";
import { getOverdueDays, calcAvgCollectionDays } from "@/lib/date-utils";

export type HealthStatus = "Good" | "Average" | "Risky";

export interface CustomerHealth {
  customerName: string;
  status: HealthStatus;
  score: number; // 0-100
  factors: string[];
}

/**
 * Calculate health score for a customer based on:
 * - Average collection days (weight: 40%)
 * - Max overdue days on outstanding bills (weight: 30%)
 * - Collection rate (weight: 30%)
 */
export function calculateHealthScore(
  customerName: string,
  invoices: Invoice[],
  payments: RecordedPayment[]
): CustomerHealth {
  const custInvoices = invoices.filter(i => i.customerName === customerName);
  const custPayments = payments.filter(p => p.customerName === customerName);

  if (custInvoices.length === 0) {
    return { customerName, status: "Good", score: 100, factors: ["No invoices"] };
  }

  const factors: string[] = [];
  let score = 100;

  // 1. Average collection days (40 points)
  const avgDays = calcAvgCollectionDays(custInvoices, custPayments);
  if (avgDays !== null) {
    if (avgDays > 60) { score -= 40; factors.push(`Avg ${avgDays}d to pay`); }
    else if (avgDays > 45) { score -= 30; factors.push(`Avg ${avgDays}d to pay`); }
    else if (avgDays > 30) { score -= 20; factors.push(`Avg ${avgDays}d to pay`); }
    else if (avgDays > 15) { score -= 10; factors.push(`Avg ${avgDays}d to pay`); }
  }

  // 2. Max overdue on outstanding (30 points)
  const outstandingInvs = custInvoices.filter(i => i.outstandingAmount > 0);
  const maxOverdue = outstandingInvs.length > 0
    ? Math.max(...outstandingInvs.map(i => getOverdueDays(i.billDate)))
    : 0;
  if (maxOverdue > 90) { score -= 30; factors.push(`${maxOverdue}d overdue`); }
  else if (maxOverdue > 60) { score -= 22; factors.push(`${maxOverdue}d overdue`); }
  else if (maxOverdue > 30) { score -= 15; factors.push(`${maxOverdue}d overdue`); }
  else if (maxOverdue > 15) { score -= 8; factors.push(`${maxOverdue}d overdue`); }

  // 3. Collection rate (30 points)
  const totalBill = custInvoices.reduce((s, i) => s + i.billAmount, 0);
  const totalPaid = custInvoices.reduce((s, i) => s + i.paidAmount, 0);
  const collectionRate = totalBill > 0 ? (totalPaid / totalBill) * 100 : 100;
  if (collectionRate < 30) { score -= 30; factors.push(`${Math.round(collectionRate)}% collected`); }
  else if (collectionRate < 50) { score -= 20; factors.push(`${Math.round(collectionRate)}% collected`); }
  else if (collectionRate < 70) { score -= 12; factors.push(`${Math.round(collectionRate)}% collected`); }
  else if (collectionRate < 90) { score -= 5; }

  score = Math.max(0, Math.min(100, score));

  const status: HealthStatus = score >= 70 ? "Good" : score >= 40 ? "Average" : "Risky";

  return { customerName, status, score, factors };
}

/** Batch calculate health for all customers */
export function calculateAllHealthScores(
  invoices: Invoice[],
  payments: RecordedPayment[]
): Map<string, CustomerHealth> {
  const customers = new Set(invoices.map(i => i.customerName));
  const map = new Map<string, CustomerHealth>();
  for (const name of customers) {
    map.set(name, calculateHealthScore(name, invoices, payments));
  }
  return map;
}

export function getHealthColor(status: HealthStatus) {
  switch (status) {
    case "Good": return { text: "text-success", bg: "bg-success/10", border: "border-success/30" };
    case "Average": return { text: "text-warning", bg: "bg-warning/10", border: "border-warning/30" };
    case "Risky": return { text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" };
  }
}
