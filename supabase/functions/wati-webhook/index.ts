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

/** Parse a date from text like "25/03/2026" or "25-03-2026" */
function parseDateText(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y.length === 2 ? "20" + y : y}`;
  }
  return null;
}

/** Get a future date string */
function getFutureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getEndOfMonth(): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${String(lastDay.getDate()).padStart(2, "0")}/${String(lastDay.getMonth() + 1).padStart(2, "0")}/${lastDay.getFullYear()}`;
}

// In-memory map to track customers awaiting date input (phone -> timestamp)
// Note: This resets on function cold start, but covers the typical quick-reply flow
const awaitingDateReply = new Map<string, number>();

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

      // --- Handle "Will Pay Later" button ---
      if (lowerText === "will pay later") {
        console.log(`"Will Pay Later" from ${phone} (${contactName})`);

        // Mark this phone as awaiting date reply
        awaitingDateReply.set(phone, Date.now());

        const tomorrow = getFutureDate(1);
        const nextWeek = getFutureDate(7);
        const endOfMonth = getEndOfMonth();

        const datePrompt = [
          `*${contactName}, कृपया पेमेंट तारीख सांगा:*`,
          "",
          `1️⃣ उद्या (${tomorrow})`,
          `2️⃣ पुढील आठवडा (${nextWeek})`,
          `3️⃣ महिन्याच्या शेवटी (${endOfMonth})`,
          "",
          `किंवा तारीख टाइप करा (DD/MM/YYYY)`,
        ].join("\n");

        await sendSessionMessage(phone, datePrompt);

        // Log the button click
        await logToSheets({
          phone,
          contactName,
          messageText,
          messageType: "button_reply",
          direction,
          timestamp,
          waId,
        });

        return new Response(JSON.stringify({ success: true, action: "date_prompt_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Handle date reply (after "Will Pay Later") ---
      const isAwaitingDate = awaitingDateReply.has(phone);
      let paymentDate: string | null = null;

      if (isAwaitingDate) {
        // Check for numbered options
        if (messageText === "1" || lowerText.includes("उद्या")) {
          paymentDate = getFutureDate(1);
        } else if (messageText === "2" || lowerText.includes("आठवडा")) {
          paymentDate = getFutureDate(7);
        } else if (messageText === "3" || lowerText.includes("शेवटी") || lowerText.includes("महिन्या")) {
          paymentDate = getEndOfMonth();
        } else {
          // Try to parse typed date
          paymentDate = parseDateText(messageText);
        }

        if (paymentDate) {
          awaitingDateReply.delete(phone);
          console.log(`Payment promise from ${phone}: will pay on ${paymentDate}`);

          const confirmMsg = `✅ धन्यवाद ${contactName}! आम्ही ${paymentDate} रोजी पेमेंटची अपेक्षा करतो.\n\n- *SUSHIL AGENCIES, JALNA*`;
          await sendSessionMessage(phone, confirmMsg);

          // Log payment promise with date
          await logToSheets({
            phone,
            contactName,
            messageText: `PAYMENT PROMISE: Will pay on ${paymentDate}`,
            messageType: "payment_promise",
            direction,
            timestamp,
            waId,
          });

          return new Response(JSON.stringify({ success: true, action: "payment_promise_logged", date: paymentDate }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // If we couldn't parse the date, fall through to normal logging
      }

      // --- Handle "Will Pay Today" button ---
      if (lowerText === "will pay today") {
        console.log(`"Will Pay Today" from ${phone} (${contactName})`);
        const today = getFutureDate(0);

        const confirmMsg = `✅ धन्यवाद ${contactName}! आज पेमेंट मिळेल अशी अपेक्षा करतो.\n\n- *SUSHIL AGENCIES, JALNA*`;
        await sendSessionMessage(phone, confirmMsg);

        await logToSheets({
          phone,
          contactName,
          messageText: `PAYMENT PROMISE: Will pay today (${today})`,
          messageType: "payment_promise",
          direction,
          timestamp,
          waId,
        });

        return new Response(JSON.stringify({ success: true, action: "will_pay_today_logged" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Handle "Send Bank A/C No." button ---
      if (lowerText.includes("send bank") || lowerText.includes("bank a/c")) {
        console.log(`"Send Bank A/C" from ${phone} (${contactName})`);

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
          contactName,
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

      // --- Handle "4" or "statement" reply ---
      if (messageText === "4" || lowerText.includes("statement")) {
        console.log(`Statement request from ${phone} (${contactName})`);

        await logToSheets({
          phone,
          contactName,
          messageText: "REQUEST: Statement requested",
          messageType: "statement_request",
          direction,
          timestamp,
          waId,
        });

        // For now, log the request — statement PDF sending can be added later
        const ackMsg = `📄 ${contactName}, आपला Statement तयार केला जात आहे. लवकरच पाठवला जाईल.\n\n- *SUSHIL AGENCIES, JALNA*`;
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
