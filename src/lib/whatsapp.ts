import type { Invoice } from "@/lib/invoice";
import { getOverdueDays } from "@/lib/date-utils";
import { sendWatiTemplateMessage } from "@/lib/wati";

export function buildReminderMessage(customerName: string, invoices: Invoice[]): string {
  const outstanding = invoices.filter((i) => i.outstandingAmount > 0);
  if (outstanding.length === 0) return "";

  const lines: string[] = [];
  lines.push(`*नमस्कार ${customerName}*`);
  lines.push("");
  lines.push("आपल्या खात्यात खालील बिलांची थकबाकी प्रलंबित आहे:");
  lines.push("");

  for (const inv of outstanding) {
    const overdueDays = getOverdueDays(inv.billDate);
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
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("91") || cleaned.length <= 10) {
    cleaned = "91" + cleaned;
  }
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

/** Send via WATI template API */
export async function sendViaWati(
  phone: string,
  customerName: string,
  invoices: Invoice[]
): Promise<{ success: boolean; error?: string }> {
  const outstanding = invoices.filter((i) => i.outstandingAmount > 0);
  if (outstanding.length === 0) return { success: false, error: "No outstanding invoices" };

  const total = outstanding.reduce((s, i) => s + i.outstandingAmount, 0);

  // WATI does not allow newline/tab in template params, so use bullet separator
  const invoiceLines = outstanding.map((inv) => {
    const overdueDays = getOverdueDays(inv.billDate);
    return `• ${inv.billNo} | ${inv.billDate} | ₹${inv.outstandingAmount.toLocaleString("en-IN")} | ${overdueDays} दिवस`;
  }).join(" ◆ ");

  const parameters = [
    { name: "1", value: customerName },
    { name: "2", value: invoiceLines },
    { name: "3", value: total.toLocaleString("en-IN") },
  ];

  const result = await sendWatiTemplateMessage(phone, "payment_reminder_utility_v1", parameters, "payment_reminder");
  return { success: result.success, error: result.error };
}
