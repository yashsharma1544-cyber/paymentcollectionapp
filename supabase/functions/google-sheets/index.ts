import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPREADSHEET_ID = "1IH-MYfQi324eMeiPXD5otZz_9trPlVUDBJViTgVWEuI";

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(serviceAccountKey: Record<string, string>): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccountKey.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const signatureInput = `${header}.${claimSet}`;

  const normalizedPrivateKey = serviceAccountKey.private_key.replace(/\\n/g, "\n");
  if (!normalizedPrivateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY: private_key format is invalid");
  }

  const pemContents = normalizedPrivateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const jwt = `${signatureInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured");
    }

    const serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "GET" ? "fetch" : null);

    if (!action) {
      throw new Error("Invalid action. Use ?action=fetch or ?action=record");
    }

    const accessToken = await getAccessToken(serviceAccountKey);

    if (action === "fetch") {
      // Fetch Outstanding tab
      const range = encodeURIComponent("Outstanding!A1:Z5000");
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;

      const response = await fetch(sheetsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "record") {
      const body = await req.json();
      const { billNo, customerName, paidAmount } = body;

      if (!billNo || !customerName || paidAmount === undefined) {
        throw new Error("Missing required fields: billNo, customerName, paidAmount");
      }

      const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const values = [[billNo, customerName, paidAmount, timestamp]];

      const range = encodeURIComponent("Record Payments!A:D");
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;

      const response = await fetch(sheetsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "record-batch") {
      const body = await req.json();
      const { allocations } = body;

      if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
        throw new Error("Missing or empty allocations array");
      }

      const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const values = allocations.map((a: { billNo: string; customerName: string; paidAmount: number }) => [
        a.billNo, a.customerName, a.paidAmount, timestamp,
      ]);

      const range = encodeURIComponent("Record Payments!A:D");
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;

      const response = await fetch(sheetsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "fetch-payments") {
      const range = encodeURIComponent("Record Payments!A1:Z10000");
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;

      const response = await fetch(sheetsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      throw new Error("Invalid action. Use ?action=fetch, ?action=record, or ?action=fetch-payments");
    }
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
