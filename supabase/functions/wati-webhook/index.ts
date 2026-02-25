import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // WATI sends webhook as POST with JSON body
    const payload = await req.json();
    console.log("WATI Webhook received:", JSON.stringify(payload));

    // Extract relevant fields from WATI webhook payload
    const waId = payload?.waId || payload?.contact?.wa_id || "";
    const phone = waId.replace(/^91/, "") || "";
    const contactName = payload?.senderName || payload?.contact?.name || payload?.pushName || phone;
    const messageText = payload?.text || payload?.message?.text || payload?.listReply?.title || "";
    const messageType = payload?.type || payload?.message?.type || "text";
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const direction = payload?.owner === true ? "outgoing" : "incoming";

    // Store in Google Sheets via the google-sheets function
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (SUPABASE_URL && SUPABASE_ANON_KEY && messageText) {
      // Append to "WA Replies" sheet via google-sheets function
      const gsUrl = `${SUPABASE_URL}/functions/v1/google-sheets?action=log-wa-reply`;
      const gsResponse = await fetch(gsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          contactName,
          messageText,
          messageType,
          direction,
          timestamp,
          waId,
        }),
      });

      if (!gsResponse.ok) {
        const errText = await gsResponse.text();
        console.error("Failed to log WA reply:", errText);
      }
    }

    // WATI expects 200 OK
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Webhook Error:", error);
    // Always return 200 to WATI to prevent retries
    return new Response(JSON.stringify({ success: true, note: "error handled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
