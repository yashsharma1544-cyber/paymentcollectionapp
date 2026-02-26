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

function buildRows(invoices: Invoice[], currencyPrefix = "Rs.") {
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
        `${currencyPrefix}${inv.billAmount.toLocaleString("en-IN")}`,
        `${currencyPrefix}${inv.paidAmount.toLocaleString("en-IN")}`,
        `${currencyPrefix}${inv.outstandingAmount.toLocaleString("en-IN")}`,
        inv.beat || "",
      ]);
    }
  }
  return { rows, groups };
}

const GROUP_HEADERS = ["Bill No", "Bill Date", "Due Date", "Bill Amt", "Paid", "Outstanding"];

export function exportToPDF(invoices: Invoice[], title: string) {
  const groups = groupInvoicesByCustomer(invoices);
  const totalOutstanding = groups.reduce((s, g) => s + g.totalOutstanding, 0);
  const totalInvoices = groups.reduce((s, g) => s + g.invoices.length, 0);

  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title - centered
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(`${title} - Outstanding Report`, pageWidth / 2, 20, { align: "center" });

  // Summary line
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-IN")}  |  Customers: ${groups.length}  |  Invoices: ${totalInvoices}  |  Total Outstanding: Rs.${totalOutstanding.toLocaleString("en-IN")}`,
    pageWidth / 2, 28,
    { align: "center" }
  );

  let startY = 36;

  for (const group of groups) {
    const rows = group.invoices.map((inv) => [
      inv.billNo,
      inv.billDate,
      inv.dueDate,
      `Rs.${inv.billAmount.toLocaleString("en-IN")}`,
      `Rs.${inv.paidAmount.toLocaleString("en-IN")}`,
      `Rs.${inv.outstandingAmount.toLocaleString("en-IN")}`,
    ]);

    // Check if we need a new page (header + at least 1 row ≈ 30px)
    if (startY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      startY = 20;
    }

    // Customer header row - use a 4-column layout with generous widths
    autoTable(doc, {
      startY,
      head: [[
        { content: group.customerName, styles: { halign: "left" } },
        { content: `Beat: ${group.invoices[0]?.beat || "N/A"}`, styles: { halign: "center" } },
        { content: `Mobile: ${group.mobileNo}`, styles: { halign: "center" } },
        { content: `Outstanding: Rs.${group.totalOutstanding.toLocaleString("en-IN")}`, styles: { halign: "right" } },
      ]],
      body: [],
      theme: "plain",
      styles: { fontSize: 11, cellPadding: 4, textColor: [0, 0, 0], fontStyle: "bold" },
      headStyles: { fillColor: [230, 235, 245], lineWidth: 0.3, lineColor: [180, 180, 180], minCellHeight: 12 },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 60 },
        2: { cellWidth: 60 },
        3: { cellWidth: 80 },
      },
      margin: { left: 14, right: 14 },
    });

    const afterHeader = (doc as any).lastAutoTable?.finalY || startY + 12;

    // Invoice rows
    autoTable(doc, {
      startY: afterHeader,
      head: [GROUP_HEADERS],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
        halign: "center",
      },
      headStyles: {
        fillColor: [41, 98, 180],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      columnStyles: {
        5: { fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });

    startY = ((doc as any).lastAutoTable?.finalY || afterHeader) + 8;
  }

  const safeName = title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
  doc.save(`${safeName}_Outstanding.pdf`);
}

export function exportToExcel(invoices: Invoice[], title: string) {
  const { rows, groups } = buildRows(invoices, "₹");
  const totalOutstanding = groups.reduce((s, g) => s + g.totalOutstanding, 0);

  // Build data with summary header
  const wsData = [
    [title],
    [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
    [`Total Outstanding: ₹${totalOutstanding.toLocaleString("en-IN")}`, "", `Customers: ${groups.length}`, `Invoices: ${rows.length}`],
    [],
    ["Customer", "Mobile", "Bill No", "Bill Date", "Due Date", "Bill Amt", "Paid", "Outstanding", "Beat"],
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
