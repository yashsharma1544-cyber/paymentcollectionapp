import type { Invoice } from "@/lib/invoice";
import type { WhatsAppLogEntry, RecordedPayment } from "@/lib/api";
import { getOverdueDays } from "@/lib/date-utils";

export type EscalationLevel = "normal" | "firm" | "visit" | "final" | "supply_stop";

export interface DefaulterInfo {
  customerName: string;
  totalOutstanding: number;
  maxOverdueDays: number;
  riskScore: number; // amount × days
  reminderCount: number;
  escalationLevel: EscalationLevel;
  beat: string;
  mobileNo: string;
  invoiceCount: number;
  lastReminderDate: string | null;
  hasPaymentInLast30Days: boolean;
}

export function getEscalationLevel(reminderCount: number): EscalationLevel {
  if (reminderCount >= 10) return "supply_stop";
  if (reminderCount >= 7) return "final";
  if (reminderCount >= 5) return "visit";
  if (reminderCount >= 3) return "firm";
  return "normal";
}

export function getEscalationLabel(level: EscalationLevel): string {
  switch (level) {
    case "supply_stop": return "Supply Stopped";
    case "final": return "Final Notice";
    case "visit": return "Visit Required";
    case "firm": return "Firm Warning";
    case "normal": return "Normal";
  }
}

export function getEscalationColor(level: EscalationLevel): string {
  switch (level) {
    case "supply_stop": return "bg-destructive text-destructive-foreground";
    case "final": return "bg-destructive/80 text-destructive-foreground";
    case "visit": return "bg-warning text-warning-foreground";
    case "firm": return "bg-orange-500 text-white";
    case "normal": return "bg-muted text-muted-foreground";
  }
}

export function getTemplateName(level: EscalationLevel): string | null {
  switch (level) {
    case "firm": return "payment_alert";
    case "visit": return "payment_warning_visit";
    case "final": return "payment_final_notice";
    case "supply_stop": return "payment_supply_stop";
    default: return null;
  }
}

/** Get available approved templates for manual sending */
export const APPROVED_TEMPLATES = [
  { name: "payment_alert", label: "⚠️ Payment Alert", description: "Firm payment reminder" },
  { name: "payment_warning_visit", label: "🏠 Visit Warning", description: "Warning about upcoming visit" },
  { name: "payment_final_notice", label: "⛔ Final Notice", description: "Final notice before action" },
  { name: "payment_supply_stop", label: "🚫 Supply Stop", description: "Supply suspension notice" },
] as const;

/**
 * Count how many reminders were sent to each customer from WhatsApp log.
 */
function countReminders(whatsappLog: WhatsAppLogEntry[]): Map<string, { count: number; lastDate: string | null }> {
  const map = new Map<string, { count: number; lastDate: string | null }>();
  for (const entry of whatsappLog) {
    const name = entry.customerName;
    if (!name) continue;
    const existing = map.get(name);
    if (existing) {
      existing.count++;
      if (!existing.lastDate || entry.timestamp > existing.lastDate) {
        existing.lastDate = entry.timestamp;
      }
    } else {
      map.set(name, { count: 1, lastDate: entry.timestamp || null });
    }
  }
  return map;
}

/**
 * Check if a customer has made any payment in the last 30 days
 */
function hasRecentPayment(customerName: string, payments: RecordedPayment[]): boolean {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return payments.some(p => {
    if (p.customerName !== customerName) return false;
    // Parse DD/MM/YYYY timestamp
    const match = p.timestamp?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      return d >= thirtyDaysAgo;
    }
    const d = new Date(p.timestamp);
    return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
  });
}

/**
 * Build the full defaulter list from invoices, WhatsApp log, and payments.
 */
export function buildDefaulterList(
  invoices: Invoice[],
  whatsappLog: WhatsAppLogEntry[],
  payments: RecordedPayment[]
): DefaulterInfo[] {
  const reminderCounts = countReminders(whatsappLog);

  // Group invoices by customer
  const customerMap = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (inv.outstandingAmount <= 0) continue;
    const existing = customerMap.get(inv.customerName);
    if (existing) existing.push(inv);
    else customerMap.set(inv.customerName, [inv]);
  }

  const defaulters: DefaulterInfo[] = [];

  for (const [customerName, custInvoices] of customerMap) {
    const totalOutstanding = custInvoices.reduce((s, i) => s + i.outstandingAmount, 0);
    const maxOverdueDays = Math.max(...custInvoices.map(i => getOverdueDays(i.billDate)));
    const riskScore = totalOutstanding * maxOverdueDays;
    const reminderInfo = reminderCounts.get(customerName);
    const reminderCount = reminderInfo?.count || 0;
    const escalationLevel = getEscalationLevel(reminderCount);
    const beat = custInvoices[0]?.beat || "Unassigned";
    const mobileNo = custInvoices[0]?.mobileNo || "";

    defaulters.push({
      customerName,
      totalOutstanding,
      maxOverdueDays,
      riskScore,
      reminderCount,
      escalationLevel,
      beat,
      mobileNo,
      invoiceCount: custInvoices.length,
      lastReminderDate: reminderInfo?.lastDate || null,
      hasPaymentInLast30Days: hasRecentPayment(customerName, payments),
    });
  }

  // Sort by risk score descending
  defaulters.sort((a, b) => b.riskScore - a.riskScore);

  return defaulters;
}
