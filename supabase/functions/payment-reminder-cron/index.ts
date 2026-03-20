import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("91") || cleaned.length <= 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

/** Get current date in IST as DD/MM/YYYY */
function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return `${String(ist.getUTCDate()).padStart(2, "0")}/${String(ist.getUTCMonth() + 1).padStart(2, "0")}/${ist.getUTCFullYear()}`;
}

/** Convert DD/MM/YYYY to a comparable Date object */
function parseDate(dateStr: string): Date | null {
  const match = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
  return new Date(Date.UTC(year, parseInt(m) - 1, parseInt(d)));
}

/** Get days difference between today IST and a DD/MM/YYYY date (positive = overdue) */
function getDaysOverdue(dateStr: string): number {
  const target = parseDate(dateStr);
  if (!target) return 0;
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const todayIST = new Date(now.getTime() + istOffset);
  const todayMidnight = new Date(Date.UTC(todayIST.getUTCFullYear(), todayIST.getUTCMonth(), todayIST.getUTCDate()));
  const diff = todayMidnight.getTime() - target.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/** Send a session message via WATI */
async function sendWATIMessage(phone: string, message: string): Promise<boolean> {
  const WATI_API_TOKEN = (Deno.env.get("WATI_API_TOKEN") || "").replace(/^Bearer\s+/i, "");
  const WATI_API_ENDPOINT = (Deno.env.get("WATI_API_ENDPOINT") || "").replace(/\/+$/, "");
  if (!WATI_API_TOKEN || !WATI_API_ENDPOINT) return false;

  const whatsappNumber = cleanPhone(phone);

  for (const version of ["v1", "v2"]) {
    const url = `${WATI_API_ENDPOINT}/api/${version}/sendSessionMessage/${whatsappNumber}?messageText=${encodeURIComponent(message)}`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WATI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageText: message }),
      });
      if (resp.ok) return true;
      if (resp.status !== 404) return false;
    } catch (err) {
      console.error(`WATI send error (${version}):`, err);
    }
  }
  return false;
}

/** Call google-sheets edge function */
async function callSheets(action: string, method: string = "GET", body?: Record<string, unknown>): Promise<any> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const url = `${SUPABASE_URL}/functions/v1/google-sheets?action=${action}`;
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(url, opts);
  if (!resp.ok) {
    console.error(`Sheets ${action} failed:`, await resp.text());
    return null;
  }
  return resp.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const todayStr = getTodayIST();
    console.log(`Payment Reminder Cron running for ${todayStr}`);

    // 1. Fetch all follow-ups
    const followUpData = await callSheets("fetch-followups");
    if (!followUpData?.values) {
      return new Response(JSON.stringify({ success: true, message: "No follow-ups found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = followUpData.values;
    const startIdx = (rows[0]?.[0] === "Customer Name" || rows[0]?.[0] === "customerName") ? 1 : 0;

    // 2. Fetch outstanding data to get phone numbers
    const outstandingData = await callSheets("fetch");
    const outstandingRows = outstandingData?.values || [];
    
    // Build customer → phone map AND customer → unpaid invoices
    const customerPhoneMap: Record<string, string> = {};
    const customerInvoices: Record<string, { billNo: string; billDate: string; outstanding: number }[]> = {};
    const customerTotalOutstanding: Record<string, number> = {};

    for (let i = 1; i < outstandingRows.length; i++) {
      const name = outstandingRows[i]?.[1] || "";
      const phone = outstandingRows[i]?.[2] || "";
      const billNo = outstandingRows[i]?.[0] || "";
      const billDate = outstandingRows[i]?.[4] || "";
      const outstanding = parseFloat(outstandingRows[i]?.[7] || "0") || 0;

      if (name && phone) {
        customerPhoneMap[name] = phone.toString().replace(/[\s\-()]/g, "");
      }
      if (name && outstanding > 0) {
        if (!customerInvoices[name]) customerInvoices[name] = [];
        customerInvoices[name].push({ billNo, billDate, outstanding });
        customerTotalOutstanding[name] = (customerTotalOutstanding[name] || 0) + outstanding;
      }
    }

    // 3. Fetch stopped reminders list
    const stoppedData = await callSheets("fetch-stopped-reminders");
    const stoppedCustomers = new Set<string>();
    if (stoppedData?.values) {
      for (const row of stoppedData.values) {
        if (row[0]) stoppedCustomers.add(row[0]);
      }
    }
    console.log(`Stopped reminders for ${stoppedCustomers.size} customers`);

    let reminded = 0;
    let escalated = 0;
    const processed: string[] = [];

    for (let i = startIdx; i < rows.length; i++) {
      const customerName = rows[i]?.[0] || "";
      const remarks = rows[i]?.[3] || "";
      const nextFollowUpDate = rows[i]?.[4] || "";
      const status = rows[i]?.[5] || "Pending";
      const createdAt = rows[i]?.[6] || "";

      // Skip non-pending
      if (status !== "Pending" || !nextFollowUpDate || !customerName) continue;

      // Skip stopped customers
      if (stoppedCustomers.has(customerName)) {
        processed.push(`⏸️ Skipped (stopped): ${customerName}`);
        continue;
      }

      // Skip follow-ups where reminder was already sent (e.g. via WhatsApp auto-reply)
      if (remarks.includes("Reminder Sent")) {
        processed.push(`📨 Skipped (reminder already sent): ${customerName}`);
        continue;
      }

      const phone = customerPhoneMap[customerName];
      if (!phone) {
        console.log(`No phone for ${customerName}, skipping`);
        continue;
      }

      const daysOverdue = getDaysOverdue(nextFollowUpDate);

      // Due today → send morning reminder
      if (daysOverdue === 0) {
        const invoices = customerInvoices[customerName] || [];
        const total = customerTotalOutstanding[customerName] || 0;
        const invoiceLines = invoices.slice(0, 8).map(
          (inv) => `• ${inv.billNo} | ${inv.billDate} | ₹${inv.outstanding.toLocaleString("en-IN")}`
        );

        const msg = [
          `🔔 *पेमेंट रिमाइंडर*`,
          ``,
          `नमस्कार ${customerName},`,
          `आज आपल्या पेमेंटची तारीख आहे.`,
          ``,
          ...invoiceLines,
          ``,
          `*एकूण थकबाकी: ₹${total.toLocaleString("en-IN")}*`,
          ``,
          `कृपया आजच पेमेंट करा.`,
          `बँक डिटेल्ससाठी "Send Bank A/C No." पाठवा.`,
          ``,
          `- *SUSHIL AGENCIES, JALNA*`,
        ].join("\n");

        const sent = await sendWATIMessage(phone, msg);
        if (sent) {
          reminded++;
          processed.push(`✅ Reminded: ${customerName} (due today)`);

          // Log to WA Replies
          await callSheets("log-wa-reply", "POST", {
            phone,
            contactName: customerName,
            messageText: `AUTO-REMINDER: Payment due today`,
            messageType: "auto_reminder",
            direction: "outgoing",
            timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            waId: cleanPhone(phone),
          });
        } else {
          processed.push(`❌ Failed to remind: ${customerName}`);
        }
      }

      // 1 day overdue → escalation reminder
      else if (daysOverdue === 1) {
        const total = customerTotalOutstanding[customerName] || 0;
        const msg = [
          `⚠️ *पेमेंट ओव्हरड्यू*`,
          ``,
          `${customerName}, काल पेमेंटची तारीख होती पण अजून पेमेंट आलेले नाही.`,
          ``,
          `*एकूण थकबाकी: ₹${total.toLocaleString("en-IN")}*`,
          ``,
          `कृपया आज पेमेंट करा.`,
          ``,
          `- *SUSHIL AGENCIES, JALNA*`,
        ].join("\n");

        const sent = await sendWATIMessage(phone, msg);
        if (sent) {
          escalated++;
          processed.push(`⚠️ Escalated (D+1): ${customerName}`);

          await callSheets("log-wa-reply", "POST", {
            phone,
            contactName: customerName,
            messageText: `AUTO-ESCALATION (D+1): Payment overdue since ${nextFollowUpDate}`,
            messageType: "auto_escalation",
            direction: "outgoing",
            timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            waId: cleanPhone(phone),
          });
        }
      }

      // 3 days overdue → final reminder, then mark as Done (stop bothering)
      else if (daysOverdue === 3) {
        const total = customerTotalOutstanding[customerName] || 0;
        const msg = [
          `🚨 *तिसरा व शेवटचा रिमाइंडर*`,
          ``,
          `${customerName}, ${nextFollowUpDate} रोजी पेमेंट देण्याचे वचन दिले होते.`,
          ``,
          `*एकूण थकबाकी: ₹${total.toLocaleString("en-IN")}*`,
          ``,
          `कृपया तात्काळ पेमेंट करा किंवा नवीन तारीख सांगा.`,
          ``,
          `- *SUSHIL AGENCIES, JALNA*`,
        ].join("\n");

        const sent = await sendWATIMessage(phone, msg);
        if (sent) {
          escalated++;
          processed.push(`🚨 Final reminder (D+3): ${customerName}`);

          await callSheets("log-wa-reply", "POST", {
            phone,
            contactName: customerName,
            messageText: `AUTO-FINAL (D+3): Last reminder for ${nextFollowUpDate}`,
            messageType: "auto_final",
            direction: "outgoing",
            timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            waId: cleanPhone(phone),
          });

          // Mark this follow-up as Done to stop further reminders
          await callSheets("update-followup-status", "POST", {
            customerName,
            createdAt,
            status: "Done",
          });
        }
      }
    }

    const summary = {
      success: true,
      date: todayStr,
      reminded,
      escalated,
      details: processed,
    };
    console.log("Cron result:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Cron error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
