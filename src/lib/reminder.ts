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
    // Get phone from invoices
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
      // Log to WhatsApp Log so it shows in CRM
      try {
        await logWhatsApp(customerName, customerInv.mobileNo, "Manual Reminder");
      } catch {
        // Non-critical, don't fail the reminder
      }
    }
    return result;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
