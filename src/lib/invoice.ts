import { getOverdueDays, parseDateDMY } from "@/lib/date-utils";

/** Cutoff: ignore any invoice/payment dated before this. */
export const DATA_CUTOFF_DMY = "01/04/2020";
export const DATA_CUTOFF_DATE = new Date(2020, 3, 1);


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
  company?: string;
  isOpeningBalance?: boolean;
}

/** Sort invoices: opening balance first, then unpaid (oldest first), then paid */
export function sortInvoicesUnpaidFirst(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => {
    if (!!a.isOpeningBalance !== !!b.isOpeningBalance) {
      return a.isOpeningBalance ? -1 : 1;
    }
    const aPaid = a.outstandingAmount === 0 ? 1 : 0;
    const bPaid = b.outstandingAmount === 0 ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;
    return getOverdueDays(b.billDate) - getOverdueDays(a.billDate);
  });
}

/** Build a synthetic invoice from an opening balance entry */
export function openingBalanceToInvoice(ob: {
  ledgerName: string;
  openingBalance: number;
}, mobileNo = "", beat = "Unassigned"): Invoice {
  return {
    billNo: `OB-${ob.ledgerName}`,
    customerName: ob.ledgerName,
    mobileNo,
    billDate: DATA_CUTOFF_DMY,
    billAmount: ob.openingBalance,
    paidAmount: 0,
    outstandingAmount: ob.openingBalance,
    dueDate: DATA_CUTOFF_DMY,
    daysOverdue: 0,
    reminderLevel: "",
    beat,
    paymentStatus: "Pending",
    isOpeningBalance: true,
  };
}


export function parseSheetData(data: { values?: string[][] }): Invoice[] {
  if (!data.values || data.values.length === 0) return [];

  // Skip header row if present
  const first = data.values[0]?.[0]?.toString().toLowerCase() || "";
  const rows = first.includes("bill") || first.includes("invoice") ? data.values.slice(1) : data.values;
  return rows

    .map((row) => ({
      billNo: row[0] || "",
      customerName: row[1] || "",
      mobileNo: row[2] || "",
      company: row[3] || "",
      billDate: row[4] || "",
      billAmount: Math.round(parseFloat(row[5]?.replace(/[₹,]/g, "") || "0") || 0),
      paidAmount: Math.round(parseFloat(row[6]?.replace(/[₹,]/g, "") || "0") || 0),
      outstandingAmount: Math.round(parseFloat(row[7]?.replace(/[₹,]/g, "") || "0") || 0),
      dueDate: row[8] || "",
      daysOverdue: parseInt(row[9] || "0", 10),
      reminderLevel: row[9] || "",
      paymentStatus: row[10] || "Pending",
      beat: row[11] || "Unassigned",
    }))
    .filter((inv) => {
      if (!inv.billNo) return false;
      const d = parseDateDMY(inv.billDate);
      if (!d) return false;
      return d.getTime() >= DATA_CUTOFF_DATE.getTime();
    });

}
