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

async function safeJsonParse(response: Response): Promise<{ data: unknown; text: string }> {
  const text = await response.text();
  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
}

async function watiPost(baseUrl: string, path: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function watiGet(baseUrl: string, path: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

    const baseUrl = WATI_API_ENDPOINT.replace(/\/+$/, "");
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "send-session-message") {
      const body = await req.json();
      const { phone, message } = body;
      if (!phone || !message) throw new Error("Missing phone or message");

      const whatsappNumber = cleanPhone(phone);
      const response = await watiPost(baseUrl, `/api/v1/sendSessionMessage/${whatsappNumber}`, WATI_API_TOKEN, { messageText: message });
      const { data, text } = await safeJsonParse(response);

      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${text}`);
      }

      return new Response(JSON.stringify({ success: true, data: data || { status: response.status, raw: text } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "send-template-message") {
      const body = await req.json();
      const { phone, templateName, broadcastName, parameters } = body;
      if (!phone || !templateName) throw new Error("Missing phone or templateName");

      const whatsappNumber = cleanPhone(phone);
      const response = await watiPost(
        baseUrl,
        `/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`,
        WATI_API_TOKEN,
        { template_name: templateName, broadcast_name: broadcastName || "payment_reminder", parameters: parameters || [] }
      );
      const { data, text } = await safeJsonParse(response);

      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${text}`);
      }

      return new Response(JSON.stringify({ success: true, data: data || { status: response.status, raw: text } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "send-text-message") {
      const body = await req.json();
      const { phone, message } = body;
      if (!phone || !message) throw new Error("Missing phone or message");

      const whatsappNumber = cleanPhone(phone);
      const response = await watiPost(baseUrl, `/api/v2/sendSessionMessage/${whatsappNumber}`, WATI_API_TOKEN, { messageText: message });
      const { data, text } = await safeJsonParse(response);

      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${text}`);
      }

      return new Response(JSON.stringify({ success: true, data: data || { status: response.status, raw: text } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "get-messages") {
      const phone = url.searchParams.get("phone");
      if (!phone) throw new Error("Missing phone parameter");

      const whatsappNumber = cleanPhone(phone);
      const response = await watiGet(baseUrl, `/api/v1/getMessages/${whatsappNumber}`, WATI_API_TOKEN);
      const { data, text } = await safeJsonParse(response);

      if (!response.ok) {
        throw new Error(`WATI API error [${response.status}]: ${text}`);
      }

      return new Response(JSON.stringify(data || { raw: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "get-contact") {
      const phone = url.searchParams.get("phone");
      if (!phone) throw new Error("Missing phone parameter");

      const whatsappNumber = cleanPhone(phone);
      const response = await watiGet(
        baseUrl,
        `/api/v1/getContacts?pageSize=1&pageNumber=1&whatsappNumber=${whatsappNumber}`,
        WATI_API_TOKEN
      );
      const { data, text } = await safeJsonParse(response);

      return new Response(JSON.stringify(data || { raw: text }), {
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
