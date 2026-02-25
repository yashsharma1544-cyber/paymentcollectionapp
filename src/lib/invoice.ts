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
