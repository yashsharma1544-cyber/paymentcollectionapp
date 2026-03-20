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

/** Send a session message to a customer via WATI */
async function sendSessionMessage(phone: string, message: string) {
  const WATI_API_TOKEN = (Deno.env.get("WATI_API_TOKEN") || "").replace(/^Bearer\s+/i, "");
  const WATI_API_ENDPOINT = (Deno.env.get("WATI_API_ENDPOINT") || "").replace(/\/+$/, "");
  if (!WATI_API_TOKEN || !WATI_API_ENDPOINT) {
    console.error("WATI credentials not configured for auto-reply");
    return;
  }

  const whatsappNumber = cleanPhone(phone);
  
  try {
    // Try v1 first (more reliable), fall back to v2
    for (const version of ["v1", "v2"]) {
      const url = `${WATI_API_ENDPOINT}/api/${version}/sendSessionMessage/${whatsappNumber}?messageText=${encodeURIComponent(message)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WATI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageText: message }),
      });
      const text = await resp.text();
      console.log(`Auto-reply (${version}) to ${whatsappNumber}: ${resp.status}`, text);
      if (resp.ok || resp.status !== 404) return; // success or non-404 error
    }
  } catch (err) {
    console.error("Auto-reply failed:", err);
  }
}

/** Log to Google Sheets */
async function logToSheets(data: Record<string, string>) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const gsUrl = `${SUPABASE_URL}/functions/v1/google-sheets?action=log-wa-reply`;
  try {
    const gsResponse = await fetch(gsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!gsResponse.ok) {
      const errText = await gsResponse.text();
      console.error("Failed to log to sheets:", errText);
    }
  } catch (err) {
    console.error("Sheet logging error:", err);
  }
}

/** Create a follow-up entry via google-sheets function */
async function createFollowUp(customerName: string, remarks: string, nextFollowUpDate: string, status: string = "Pending") {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const gsUrl = `${SUPABASE_URL}/functions/v1/google-sheets?action=add-followup`;
  try {
    // Convert DD/MM/YYYY to YYYY-MM-DD for the follow-up date field
    const parts = nextFollowUpDate.split("/");
    const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : nextFollowUpDate;

    const gsResponse = await fetch(gsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerName,
        remarks,
        nextFollowUpDate: isoDate,
        type: "WhatsApp Auto",
        status,
        addedBy: "WATI Bot",
      }),
    });
    if (!gsResponse.ok) {
      const errText = await gsResponse.text();
      console.error("Failed to create follow-up:", errText);
    } else {
      console.log(`Follow-up created for ${customerName} on ${nextFollowUpDate}`);
    }
  } catch (err) {
    console.error("Follow-up creation error:", err);
  }
}

/** Look up business customer name by phone number (lightweight — fetches only 2 columns) */
async function lookupCustomerName(phone: string): Promise<string | null> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  try {
    const gsUrl = `${SUPABASE_URL}/functions/v1/google-sheets?action=lookup-customer&phone=${encodeURIComponent(phone)}`;
    const gsResponse = await fetch(gsUrl, {
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!gsResponse.ok) return null;
    const data = await gsResponse.json();
    return data?.customerName || null;
  } catch (err) {
    console.error("Customer lookup error:", err);
  }
  return null;
}

/** Parse a date string like DD/MM/YYYY */
function parseDateText(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y.length === 2 ? "20" + y : y}`;
  }
  return null;
}

/** Get current date/time in IST */
function getNowIST(): Date {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
}

/** Get a future date string in IST */
function getFutureDate(daysFromNow: number): string {
  const d = getNowIST();
  d.setDate(d.getDate() + daysFromNow);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function getEndOfMonth(): string {
  const now = getNowIST();
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return `${String(lastDay.getUTCDate()).padStart(2, "0")}/${String(lastDay.getUTCMonth() + 1).padStart(2, "0")}/${lastDay.getUTCFullYear()}`;
}

// No in-memory state needed — date replies are detected by pattern matching

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("WATI Webhook received:", JSON.stringify(payload));

    const waId = payload?.waId || payload?.contact?.wa_id || "";
    const phone = waId.replace(/^91/, "") || "";
    const contactName = payload?.senderName || payload?.contact?.name || payload?.pushName || phone;
    const messageText = (payload?.text || payload?.message?.text || payload?.listReply?.title || "").trim();
    const messageType = payload?.type || payload?.message?.type || "text";
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const direction = payload?.owner === true ? "outgoing" : "incoming";

    // Only process incoming messages
    if (direction === "incoming" && messageText) {
      const lowerText = messageText.toLowerCase();
      
      // Look up the business customer name by phone (fallback to WhatsApp contact name)
      const customerName = await lookupCustomerName(phone) || contactName;

      // --- Handle "Will Pay Later" button ---
      if (lowerText === "will pay later") {
        console.log(`"Will Pay Later" from ${phone} (${customerName})`);

        const tomorrow = getFutureDate(1);
        const nextWeek = getFutureDate(7);
        const endOfMonth = getEndOfMonth();

        const datePrompt = [
          `*${customerName}, कृपया पेमेंट तारीख सांगा:*`,
          "",
          `1️⃣ उद्या (${tomorrow})`,
          `2️⃣ पुढील आठवडा (${nextWeek})`,
          `3️⃣ महिन्याच्या शेवटी (${endOfMonth})`,
          "",
          `किंवा तारीख टाइप करा (DD/MM/YYYY)`,
        ].join("\n");

        await sendSessionMessage(phone, datePrompt);

        // Auto-create a default follow-up for 7 days in case they never reply with a date
        await createFollowUp(customerName, `WhatsApp: Clicked "Will Pay Later" — no date given yet`, nextWeek);

        // Log the button click
        await logToSheets({
          phone,
          contactName: customerName,
          messageText: `Will Pay Later (default follow-up: ${nextWeek})`,
          messageType: "button_reply",
          direction,
          timestamp,
          waId,
        });

        return new Response(JSON.stringify({ success: true, action: "date_prompt_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Handle date reply (works without in-memory state) ---
      // Try to detect date patterns: "1", "2", "3", or DD/MM/YYYY format
      let paymentDate: string | null = null;

      if (messageText === "1") {
        paymentDate = getFutureDate(1);
      } else if (messageText === "2") {
        paymentDate = getFutureDate(7);
      } else if (messageText === "3") {
        paymentDate = getEndOfMonth();
      } else {
        // Try to parse typed date like "15/03/2026"
        paymentDate = parseDateText(messageText);
      }

      if (paymentDate) {
        // Validate: manually typed dates must be within 30 days from today
        const [dd, mm, yyyy] = paymentDate.split("/").map(Number);
        const promisedDate = new Date(yyyy, mm - 1, dd);
        const now = getNowIST();
        const today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 30);

        if (promisedDate < today) {
          const rejectMsg = `⚠️ ${customerName}, कृपया भविष्यातील तारीख द्या. मागील तारीख स्वीकारली जात नाही.\n\nकृपया पुन्हा तारीख टाइप करा (DD/MM/YYYY).`;
          await sendSessionMessage(phone, rejectMsg);
          return new Response(JSON.stringify({ success: true, action: "date_rejected_past" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (promisedDate > maxDate) {
          const maxDateStr = `${String(maxDate.getDate()).padStart(2, "0")}/${String(maxDate.getMonth() + 1).padStart(2, "0")}/${maxDate.getFullYear()}`;
          const rejectMsg = `⚠️ ${customerName}, कृपया आजपासून 30 दिवसांच्या आत तारीख द्या (${maxDateStr} पर्यंत).\n\nकृपया पुन्हा तारीख टाइप करा (DD/MM/YYYY).`;
          await sendSessionMessage(phone, rejectMsg);
          return new Response(JSON.stringify({ success: true, action: "date_rejected_too_far" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`Payment promise from ${phone}: will pay on ${paymentDate}`);

        const confirmMsg = `✅ धन्यवाद ${customerName}! आम्ही ${paymentDate} रोजी पेमेंटची अपेक्षा करतो.\n\n- *SUSHIL AGENCIES, JALNA*`;
        await sendSessionMessage(phone, confirmMsg);

        // Log payment promise with date
        await logToSheets({
          phone,
          contactName: customerName,
          messageText: `PAYMENT PROMISE: Will pay on ${paymentDate}`,
          messageType: "payment_promise",
          direction,
          timestamp,
          waId,
        });

        // Auto-create follow-up for the promised date
        await createFollowUp(customerName, `WhatsApp: Will pay on ${paymentDate}`, paymentDate);

        return new Response(JSON.stringify({ success: true, action: "payment_promise_logged", date: paymentDate }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Handle "Will Pay Today" button ---
      if (lowerText === "will pay today") {
        console.log(`"Will Pay Today" from ${phone} (${customerName})`);
        const today = getFutureDate(0);

        const confirmMsg = `✅ धन्यवाद ${customerName}! आज पेमेंट मिळेल अशी अपेक्षा करतो.\n\n- *SUSHIL AGENCIES, JALNA*`;
        await sendSessionMessage(phone, confirmMsg);

        await logToSheets({
          phone,
          contactName: customerName,
          messageText: `PAYMENT PROMISE: Will pay today (${today})`,
          messageType: "payment_promise",
          direction,
          timestamp,
          waId,
        });

        // Auto-create follow-up for today
        await createFollowUp(customerName, "WhatsApp: Will pay today", today);

        return new Response(JSON.stringify({ success: true, action: "will_pay_today_logged" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Handle "Send Bank A/C No." button ---
      if (lowerText.includes("send bank") || lowerText.includes("bank a/c")) {
        console.log(`"Send Bank A/C" from ${phone} (${customerName})`);

        const bankDetails = [
          "*बँक खाते तपशील:*",
          "",
          "🏦 Bank: *HDFC Bank*",
          "👤 Name: *SUSHIL AGENCIES*",
          "🔢 A/C No: *50200058144303*",
          "🏛️ IFSC: *HDFC0009256*",
          "📍 Branch: *OLD MONDHA JALNA*",
          "📋 Type: *Current Account*",
          "",
          "पेमेंट केल्यानंतर कृपया स्क्रीनशॉट पाठवा.",
          "",
          "- *SUSHIL AGENCIES, JALNA*",
        ].join("\n");

        await sendSessionMessage(phone, bankDetails);

        await logToSheets({
          phone,
          contactName: customerName,
          messageText: "REQUEST: Bank A/C details sent",
          messageType: "bank_details_request",
          direction,
          timestamp,
          waId,
        });

        return new Response(JSON.stringify({ success: true, action: "bank_details_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Handle "Complaint" reply ---
      if (lowerText === "complaint" || lowerText.startsWith("complaint ") || lowerText.startsWith("complaint:")) {
        console.log(`Complaint from ${phone} (${customerName}): ${messageText}`);

        await logToSheets({
          phone,
          contactName: customerName,
          messageText: `COMPLAINT: ${messageText}`,
          messageType: "complaint",
          direction,
          timestamp,
          waId,
        });

        const ackMsg = `🙏 ${customerName}, आपली तक्रार नोंदवली गेली आहे. आमचे प्रतिनिधी लवकरच आपल्याशी संपर्क साधतील.\n\n- *SUSHIL AGENCIES, JALNA*`;
        await sendSessionMessage(phone, ackMsg);

        return new Response(JSON.stringify({ success: true, action: "complaint_logged" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Handle "4" or "statement" reply ---
      if (messageText === "4" || lowerText.includes("statement")) {
        console.log(`Statement request from ${phone} (${customerName})`);

        await logToSheets({
          phone,
          contactName: customerName,
          messageText: "REQUEST: Statement requested",
          messageType: "statement_request",
          direction,
          timestamp,
          waId,
        });

        // For now, log the request — statement PDF sending can be added later
        const ackMsg = `📄 ${customerName}, आपला Statement तयार केला जात आहे. लवकरच पाठवला जाईल.\n\n- *SUSHIL AGENCIES, JALNA*`;
        await sendSessionMessage(phone, ackMsg);

        return new Response(JSON.stringify({ success: true, action: "statement_requested" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Default: log all messages to sheets
    if (messageText) {
      await logToSheets({
        phone,
        contactName,
        messageText,
        messageType,
        direction,
        timestamp,
        waId,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ success: true, note: "error handled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
