import type { Invoice } from "@/lib/invoice";
import { getOverdueDays } from "@/lib/date-utils";

export function buildReminderMessage(customerName: string, invoices: Invoice[]): string {
  const outstanding = invoices.filter((i) => i.outstandingAmount > 0);
  if (outstanding.length === 0) return "";

  const lines: string[] = [];
  lines.push(`*नमस्कार ${customerName}*`);
  lines.push("");
  lines.push("आपल्या खात्यात खालील बिलांची थकबाकी प्रलंबित आहे:");
  lines.push("");

  for (const inv of outstanding) {
    const overdueDays = getOverdueDays(inv.dueDate);
    lines.push(
      `• बिल नं: ${inv.billNo} | दिनांक: ${inv.billDate} | थकबाकी: ₹${inv.outstandingAmount.toLocaleString("en-IN")} | थकीत दिवस: ${overdueDays}`
    );
  }

  const total = outstanding.reduce((s, i) => s + i.outstandingAmount, 0);
  lines.push("");
  lines.push(`*एकूण थकबाकी: ₹${total.toLocaleString("en-IN")}*`);
  lines.push("");
  lines.push("कृपया लवकरात लवकर पेमेंट करून सहकार्य करावे.");
  lines.push("");
  lines.push("धन्यवाद,");
  lines.push("");
  lines.push("*SUSHIL AGENCIES, JALNA*");

  return lines.join("\n");
}

export function openWhatsApp(phone: string, message: string): void {
  // Clean phone number - remove spaces, dashes, etc.
  let cleaned = phone.replace(/[\s\-()]/g, "");
  // Remove leading + if present
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }
  // Remove leading 0
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }
  // Add India country code if not already prefixed with 91
  if (!cleaned.startsWith("91") || cleaned.length <= 10) {
    cleaned = "91" + cleaned;
  }
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}
