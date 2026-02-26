import type { Invoice } from "@/lib/invoice";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface CustomerGroup {
  customerName: string;
  mobileNo: string;
  invoices: Invoice[];
  totalOutstanding: number;
  totalBill: number;
  totalPaid: number;
}

function groupInvoicesByCustomer(invoices: Invoice[]): CustomerGroup[] {
  const map = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (!map.has(inv.customerName)) map.set(inv.customerName, []);
    map.get(inv.customerName)!.push(inv);
  }
  return Array.from(map.entries())
    .map(([customerName, invs]) => ({
      customerName,
      mobileNo: invs[0].mobileNo,
      invoices: invs.filter((i) => i.outstandingAmount > 0),
      totalOutstanding: invs.reduce((s, i) => s + i.outstandingAmount, 0),
      totalBill: invs.reduce((s, i) => s + i.billAmount, 0),
      totalPaid: invs.reduce((s, i) => s + i.paidAmount, 0),
    }))
    .filter((g) => g.totalOutstanding > 0)
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

function buildRows(invoices: Invoice[]) {
  const groups = groupInvoicesByCustomer(invoices);
  const rows: string[][] = [];
  for (const g of groups) {
    for (const inv of g.invoices) {
      rows.push([
        g.customerName,
        g.mobileNo,
        inv.billNo,
        inv.billDate,
        inv.dueDate,
        `₹${inv.billAmount.toLocaleString("en-IN")}`,
        `₹${inv.paidAmount.toLocaleString("en-IN")}`,
        `₹${inv.outstandingAmount.toLocaleString("en-IN")}`,
        inv.beat || "",
      ]);
    }
  }
  return { rows, groups };
}

const HEADERS = ["Customer", "Mobile", "Bill No", "Bill Date", "Due Date", "Bill Amt", "Paid", "Outstanding", "Beat"];

export function exportToPDF(invoices: Invoice[], title: string) {
  const { rows, groups } = buildRows(invoices);
  const totalOutstanding = groups.reduce((s, g) => s + g.totalOutstanding, 0);

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 25);
  doc.text(`Total Outstanding: ₹${totalOutstanding.toLocaleString("en-IN")}`, 14, 31);
  doc.text(`Customers: ${groups.length} | Invoices: ${rows.length}`, 14, 37);

  autoTable(doc, {
    head: [HEADERS],
    body: rows,
    startY: 42,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 180], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  const safeName = title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
  doc.save(`${safeName}_Outstanding.pdf`);
}

export function exportToExcel(invoices: Invoice[], title: string) {
  const { rows, groups } = buildRows(invoices);
  const totalOutstanding = groups.reduce((s, g) => s + g.totalOutstanding, 0);

  // Build data with summary header
  const wsData = [
    [title],
    [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
    [`Total Outstanding: ₹${totalOutstanding.toLocaleString("en-IN")}`, "", `Customers: ${groups.length}`, `Invoices: ${rows.length}`],
    [],
    HEADERS,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Set column widths
  ws["!cols"] = [
    { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Outstanding");

  const safeName = title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
  XLSX.writeFile(wb, `${safeName}_Outstanding.xlsx`);
}
