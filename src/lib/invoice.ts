import { getOverdueDays } from "@/lib/date-utils";

export interface Invoice {
  billNo: string;
  customerName: string;
  mobileNo: string;
  billDate: string;
  billAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  daysOverdue: number;
  reminderLevel: string;
  beat: string;
  paymentStatus: string;
}

/** Sort invoices: unpaid first (descending by overdue days), paid last */
export function sortInvoicesUnpaidFirst(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => {
    const aPaid = a.outstandingAmount === 0 ? 1 : 0;
    const bPaid = b.outstandingAmount === 0 ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;
    return getOverdueDays(b.billDate) - getOverdueDays(a.billDate);
  });
}

export function parseSheetData(data: { values?: string[][] }): Invoice[] {
  if (!data.values || data.values.length < 2) return [];

  const rows = data.values.slice(1); // skip header
  return rows
    .map((row) => ({
      billNo: row[0] || "",
      customerName: row[1] || "",
      mobileNo: row[2] || "",
      billDate: row[4] || "",
      billAmount: Math.round(parseFloat(row[5]?.replace(/[₹,]/g, "") || "0")),
      paidAmount: Math.round(parseFloat(row[6]?.replace(/[₹,]/g, "") || "0")),
      outstandingAmount: Math.round(parseFloat(row[7]?.replace(/[₹,]/g, "") || "0")),
      dueDate: row[8] || "",
      daysOverdue: parseInt(row[9] || "0", 10),
      reminderLevel: row[9] || "",
      paymentStatus: row[10] || "Pending",
      beat: row[11] || "Unassigned",
    }))
    .filter((inv) => inv.billNo);
}
