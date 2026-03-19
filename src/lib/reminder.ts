import { sendWatiSessionMessage } from "@/lib/wati";
import { fetchInvoices, logWhatsApp } from "@/lib/api";

/**
 * Send a manual payment reminder to a customer via WhatsApp.
 * Looks up the customer's phone from invoices.
 */
export async function sendManualReminder(
  customerName: string,
  dueDate?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const invoices = await fetchInvoices();
    const customerInv = invoices.find((inv) => inv.customerName === customerName);
    if (!customerInv?.mobileNo) {
      return { success: false, error: `No phone number found for ${customerName}` };
    }

    const dueDateText = dueDate ? ` (${dueDate})` : "";
    const msg = [
      `🔔 *पेमेंट रिमाइंडर*`,
      ``,
      `नमस्कार ${customerName},`,
      `कृपया आपले थकबाकी पेमेंट करा${dueDateText}.`,
      ``,
      `बँक डिटेल्ससाठी "Send Bank A/C No." पाठवा.`,
      ``,
      `- *SUSHIL AGENCIES, JALNA*`,
    ].join("\n");

    const result = await sendWatiSessionMessage(customerInv.mobileNo, msg);
    if (result.success) {
      try {
        await logWhatsApp(customerName, customerInv.mobileNo, "Manual Reminder");
      } catch {
        // Non-critical
      }
    }
    return result;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Send a nudge message asking the customer to provide a specific payment date.
 */
export async function sendDateNudge(
  customerName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const invoices = await fetchInvoices();
    const customerInv = invoices.find((inv) => inv.customerName === customerName);
    if (!customerInv?.mobileNo) {
      return { success: false, error: `No phone number found for ${customerName}` };
    }

    const msg = [
      `📅 *${customerName}, कृपया पेमेंट तारीख सांगा:*`,
      ``,
      `आम्हाला आपल्या पेमेंटची तारीख कळवा जेणेकरून आम्ही फॉलो-अप करू शकू.`,
      ``,
      `1️⃣ उद्या`,
      `2️⃣ पुढील आठवडा`,
      `3️⃣ महिन्याच्या शेवटी`,
      ``,
      `किंवा तारीख टाइप करा (DD/MM/YYYY)`,
      ``,
      `- *SUSHIL AGENCIES, JALNA*`,
    ].join("\n");

    const result = await sendWatiSessionMessage(customerInv.mobileNo, msg);
    if (result.success) {
      try {
        await logWhatsApp(customerName, customerInv.mobileNo, "Date Nudge");
      } catch {
        // Non-critical
      }
    }
    return result;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
