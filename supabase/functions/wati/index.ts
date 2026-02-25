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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WATI_API_TOKEN = Deno.env.get("WATI_API_TOKEN");
    if (!WATI_API_TOKEN) throw new Error("WATI_API_TOKEN is not configured");

    const WATI_API_ENDPOINT = Deno.env.get("WATI_API_ENDPOINT");
    if (!WATI_API_ENDPOINT) throw new Error("WATI_API_ENDPOINT is not configured");

    // Remove trailing slash
    const baseUrl = WATI_API_ENDPOINT.replace(/\/+$/, "");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "send-session-message") {
      const body = await req.json();
      const { phone, message } = body;
      if (!phone || !message) throw new Error("Missing phone or message");

      const whatsappNumber = cleanPhone(phone);

      const response = await fetch(
        `${baseUrl}/api/v1/sendSessionMessage/${whatsappNumber}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WATI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messageText: message }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "send-template-message") {
      const body = await req.json();
      const { phone, templateName, broadcastName, parameters } = body;
      if (!phone || !templateName) throw new Error("Missing phone or templateName");

      const whatsappNumber = cleanPhone(phone);

      const response = await fetch(
        `${baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WATI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_name: templateName,
            broadcast_name: broadcastName || "payment_reminder",
            parameters: parameters || [],
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "send-text-message") {
      // Uses the interactive session-free text message endpoint
      const body = await req.json();
      const { phone, message } = body;
      if (!phone || !message) throw new Error("Missing phone or message");

      const whatsappNumber = cleanPhone(phone);

      const response = await fetch(
        `${baseUrl}/api/v2/sendSessionMessage/${whatsappNumber}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WATI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messageText: message }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "get-messages") {
      const phone = url.searchParams.get("phone");
      if (!phone) throw new Error("Missing phone parameter");

      const whatsappNumber = cleanPhone(phone);

      const response = await fetch(
        `${baseUrl}/api/v1/getMessages/${whatsappNumber}`,
        {
          headers: {
            Authorization: `Bearer ${WATI_API_TOKEN}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "get-contact") {
      const phone = url.searchParams.get("phone");
      if (!phone) throw new Error("Missing phone parameter");

      const whatsappNumber = cleanPhone(phone);

      const response = await fetch(
        `${baseUrl}/api/v1/getContacts?pageSize=1&pageNumber=1&whatsappNumber=${whatsappNumber}`,
        {
          headers: {
            Authorization: `Bearer ${WATI_API_TOKEN}`,
          },
        }
      );

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error("Invalid action. Supported: send-session-message, send-template-message, send-text-message, get-messages, get-contact");
    }

  } catch (error: unknown) {
    console.error("WATI Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
