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
  const dash = "-";
  const slots: { billNo: string; billDate: string; amount: string; overdueDays: string }[] = [];
  for (let i = 0; i < 3; i++) {
    if (i < outstanding.length) {
      const inv = outstanding[i];
      slots.push({
        billNo: inv.billNo,
        billDate: inv.billDate,
        amount: inv.outstandingAmount.toLocaleString("en-IN"),
        overdueDays: String(getOverdueDays(inv.billDate)),
      });
    } else {
      slots.push({ billNo: dash, billDate: dash, amount: dash, overdueDays: dash });
    }
  }

  const parameters = [
    { name: "1", value: customerName },
    { name: "2", value: slots[0].billNo },
    { name: "3", value: slots[0].billDate },
    { name: "4", value: slots[0].amount },
    { name: "5", value: slots[0].overdueDays },
    { name: "6", value: slots[1].billNo },
    { name: "7", value: slots[1].billDate },
    { name: "8", value: slots[1].amount },
    { name: "9", value: slots[1].overdueDays },
    { name: "10", value: slots[2].billNo },
    { name: "11", value: slots[2].billDate },
    { name: "12", value: slots[2].amount },
    { name: "13", value: slots[2].overdueDays },
    { name: "14", value: total.toLocaleString("en-IN") },
  ];

  const result = await sendWatiTemplateMessage(phone, "payment_reminder_marathi", parameters, "payment_reminder");
  return { success: result.success, error: result.error };
}
