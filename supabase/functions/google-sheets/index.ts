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
    "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signatureInput)
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

async function appendToSheet(accessToken: string, sheetTab: string, values: string[][]) {
  const range = encodeURIComponent(`${sheetTab}!A:Z`);
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
  if (!response.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  return data;
}

async function fetchSheet(accessToken: string, range: string) {
  const encodedRange = encodeURIComponent(range);
  const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}`;
  const response = await fetch(sheetsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  return data;
}

async function updateSheetCell(accessToken: string, range: string, value: string) {
  const encodedRange = encodeURIComponent(range);
  const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}?valueInputOption=USER_ENTERED`;
  const response = await fetch(sheetsUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[value]] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  return data;
}

/** Auto-close all pending follow-ups for a customer when payment is recorded */
async function autoClosePendingFollowUps(accessToken: string, customerName: string) {
  const data = await fetchSheet(accessToken, "Follow Ups!A:H");
  const rows = data.values || [];
  const updates: { range: string; values: string[][] }[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === customerName && (rows[i][5] || "Pending") === "Pending") {
      updates.push({
        range: `Follow Ups!F${i + 1}`,
        values: [["Done"]],
      });
    }
  }

  if (updates.length > 0) {
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
    await fetch(batchUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: updates }),
    });
    console.log(`Auto-closed ${updates.length} pending follow-ups for ${customerName}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountKeyStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKeyStr) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured");

    const serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "GET" ? "fetch" : null);
    if (!action) throw new Error("Invalid action");

    const accessToken = await getAccessToken(serviceAccountKey);
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    if (action === "fetch") {
      const data = await fetchSheet(accessToken, "Outstanding!A1:Z5000");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "record") {
      const body = await req.json();
      const { billNo, customerName, paidAmount, paymentDate, paymentMode, discount, notes, collectedBy } = body;
      if (!billNo || !customerName || paidAmount === undefined) {
        throw new Error("Missing required fields: billNo, customerName, paidAmount");
      }
      const data = await appendToSheet(accessToken, "Record Payments", [[billNo, customerName, paidAmount, timestamp, paymentDate || "", paymentMode || "Cash", discount || 0, notes || "", collectedBy || ""]]);

      // Auto-close pending follow-ups for this customer
      try {
        await autoClosePendingFollowUps(accessToken, customerName);
      } catch (e) {
        console.error("Auto-close follow-ups error:", e);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "record-batch") {
      const body = await req.json();
      const { allocations, paymentDate, paymentMode, discount, notes, collectedBy } = body;
      if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
        throw new Error("Missing or empty allocations array");
      }
      const values = allocations.map((a: { billNo: string; customerName: string; paidAmount: number }, idx: number) => [
        a.billNo, a.customerName, a.paidAmount, timestamp, paymentDate || "", paymentMode || "Cash", idx === 0 ? (discount || 0) : 0, idx === 0 ? (notes || "") : "", collectedBy || "",
      ]);
      const data = await appendToSheet(accessToken, "Record Payments", values);

      // Auto-close pending follow-ups for all unique customers in the batch
      const uniqueCustomers = [...new Set(allocations.map((a: { customerName: string }) => a.customerName))];
      for (const cust of uniqueCustomers) {
        try {
          await autoClosePendingFollowUps(accessToken, cust as string);
        } catch (e) {
          console.error(`Auto-close error for ${cust}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "fetch-payments") {
      const data = await fetchSheet(accessToken, "Record Payments!A1:Z10000");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "add-followup") {
      // Columns: Customer Name, Follow Up Date, Follow Up Time, Remarks, Next Follow Up Date, Status, Created At, Type, Added By
      const body = await req.json();
      const { customerName, remarks, nextFollowUpDate, type, addedBy } = body;
      if (!customerName) throw new Error("Missing customerName");
      const values = [[
        customerName,
        new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
        new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
        remarks || "",
        nextFollowUpDate || "",
        "Pending",
        timestamp,
        type || "Manual",
        addedBy || "",
      ]];
      const data = await appendToSheet(accessToken, "Follow Ups", values);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "fetch-followups") {
      const data = await fetchSheet(accessToken, "Follow Ups!A1:Z10000");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "log-whatsapp") {
      // Columns: Customer Name, Phone, Timestamp, Sent By
      const body = await req.json();
      const { customerName, phone, sentBy } = body;
      if (!customerName) throw new Error("Missing customerName");
      const values = [[customerName, phone || "", timestamp, sentBy || ""]];
      const data = await appendToSheet(accessToken, "WhatsApp Log", values);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "fetch-whatsapp-log") {
      const data = await fetchSheet(accessToken, "WhatsApp Log!A1:Z10000");
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "update-followup-status") {
      // Find the row by matching customerName + createdAt, then update Status column (F)
      const body = await req.json();
      const { customerName, createdAt, status } = body;
      if (!customerName || !createdAt || !status) throw new Error("Missing customerName, createdAt, or status");
      
      // Fetch all follow-ups to find the row
      const data = await fetchSheet(accessToken, "Follow Ups!A:H");
      const rows = data.values || [];
      let targetRow = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === customerName && rows[i][6] === createdAt) {
          targetRow = i + 1; // 1-indexed
          break;
        }
      }
      if (targetRow === -1) throw new Error("Follow-up not found");
      
      const result = await updateSheetCell(accessToken, `Follow Ups!F${targetRow}`, status);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "edit-followup") {
      // Find the row by matching customerName + createdAt, then update Remarks (D), Next Follow Up Date (E), Status (F)
      const body = await req.json();
      const { customerName, createdAt, remarks, nextFollowUpDate, status } = body;
      if (!customerName || !createdAt) throw new Error("Missing customerName or createdAt");
      
      const data = await fetchSheet(accessToken, "Follow Ups!A:H");
      const rows = data.values || [];
      let targetRow = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === customerName && rows[i][6] === createdAt) {
          targetRow = i + 1;
          break;
        }
      }
      if (targetRow === -1) throw new Error("Follow-up not found");
      
      // Update D, E, F columns in one PUT
      const range = encodeURIComponent(`Follow Ups!D${targetRow}:F${targetRow}`);
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
      const response = await fetch(sheetsUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[remarks || "", nextFollowUpDate || "", status || "Pending"]] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`Sheets API error: ${JSON.stringify(result)}`);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "log-wa-reply") {
      // Columns: Phone, Contact Name, Message, Type, Direction, Timestamp, WA ID
      const body = await req.json();
      const { phone, contactName, messageText, messageType, direction, timestamp: ts, waId } = body;
      const values = [[phone || "", contactName || "", messageText || "", messageType || "text", direction || "incoming", ts || timestamp, waId || ""]];
      const data = await appendToSheet(accessToken, "WA Replies", values);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "fetch-wa-replies") {
      try {
        const data = await fetchSheet(accessToken, "WA Replies!A1:Z10000");
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        // Sheet may not exist yet — return empty
        return new Response(JSON.stringify({ values: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

    } else if (action === "lookup-customer") {
      // Lightweight lookup: fetch only columns B (Customer Name) and C (Mobile) to find customer by phone
      const phone = url.searchParams.get("phone");
      if (!phone) throw new Error("Missing phone parameter");
      
      const data = await fetchSheet(accessToken, "Outstanding!B1:C5000");
      const rows = data?.values || [];
      const normalizedPhone = phone.replace(/[\s\-()]/g, "").replace(/^91/, "");
      
      let customerName = null;
      for (let i = 1; i < rows.length; i++) {
        const rowPhone = (rows[i]?.[1] || "").toString().replace(/[\s\-()]/g, "").replace(/^91/, "");
        if (rowPhone === normalizedPhone && rows[i]?.[0]) {
          customerName = rows[i][0];
          break;
        }
      }
      
      return new Response(JSON.stringify({ customerName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "edit-payment") {
      // Find row by billNo + timestamp (or billNo + customerName if timestamp is empty)
      const body = await req.json();
      const { billNo, originalTimestamp, customerName, paidAmount, paymentDate, paymentMode, discount, notes, collectedBy } = body;
      if (!billNo) throw new Error("Missing billNo");

      const data = await fetchSheet(accessToken, "Record Payments!A:I");
      const rows = data.values || [];
      let targetRow = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === billNo) {
          if (originalTimestamp && rows[i][3] === originalTimestamp) {
            targetRow = i + 1;
            break;
          } else if (!originalTimestamp && (!rows[i][3] || rows[i][3] === "") && customerName && rows[i][1] === customerName) {
            targetRow = i + 1;
            break;
          }
        }
      }
      if (targetRow === -1) throw new Error("Payment record not found");

      // Update columns C through I (Paid Amount, Timestamp, Payment Date, Payment Mode, Discount, Notes, Collected By)
      const range = encodeURIComponent(`Record Payments!C${targetRow}:I${targetRow}`);
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
      const response = await fetch(sheetsUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[
          paidAmount ?? 0,
          timestamp,
          paymentDate || "",
          paymentMode || "Cash",
          discount || 0,
          notes || "",
          collectedBy || "",
        ]] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`Sheets API error: ${JSON.stringify(result)}`);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "delete-payment") {
      const body = await req.json();
      const { billNo, originalTimestamp, customerName } = body;
      if (!billNo) throw new Error("Missing billNo");

      const data = await fetchSheet(accessToken, "Record Payments!A:I");
      const rows = data.values || [];
      let targetRow = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === billNo) {
          if (originalTimestamp && rows[i][3] === originalTimestamp) {
            targetRow = i; // 0-indexed for batchUpdate
            break;
          } else if (!originalTimestamp && (!rows[i][3] || rows[i][3] === "") && customerName && rows[i][1] === customerName) {
            targetRow = i;
            break;
          }
        }
      }
      if (targetRow === -1) throw new Error("Payment record not found");

      // Get the sheetId for "Record Payments" tab
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets(properties)`;
      const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const metaData = await metaRes.json();
      const sheet = metaData.sheets?.find((s: any) => s.properties.title === "Record Payments");
      if (!sheet) throw new Error("Record Payments sheet not found");
      const sheetId = sheet.properties.sheetId;

      // Delete the row using batchUpdate
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: targetRow, endIndex: targetRow + 1 },
            },
          }],
        }),
      });
      const batchResult = await batchRes.json();
      if (!batchRes.ok) throw new Error(`Sheets API error: ${JSON.stringify(batchResult)}`);
      return new Response(JSON.stringify({ success: true, data: batchResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "update-payment-headers") {
      const range = encodeURIComponent("Record Payments!A1:I1");
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
      const response = await fetch(sheetsUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [["Bill No", "Customer Name", "Paid Amount", "Timestamp", "Payment Date", "Payment Mode", "Discount", "Notes", "Collected By"]] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`Sheets API error: ${JSON.stringify(result)}`);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "backfill-timestamps") {
      // Find all rows missing timestamps and fill them with payment date or "Imported"
      const data = await fetchSheet(accessToken, "Record Payments!A:I");
      const rows = data.values || [];
      const updates: { range: string; values: string[][] }[] = [];
      let count = 0;

      for (let i = 1; i < rows.length; i++) {
        const ts = rows[i][3] || "";
        if (!ts.trim()) {
          // Use payment date (col E/index 4) if available, otherwise "Imported"
          const paymentDate = rows[i][4] || "";
          const fallback = paymentDate ? `${paymentDate}, 00:00:00` : "Imported";
          updates.push({
            range: `Record Payments!D${i + 1}`,
            values: [[fallback]],
          });
          count++;
        }
      }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ success: true, updated: 0, message: "All records already have timestamps" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Batch update using batchUpdate values
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: updates,
        }),
      });
      const batchResult = await batchRes.json();
      if (!batchRes.ok) throw new Error(`Sheets API error: ${JSON.stringify(batchResult)}`);
      return new Response(JSON.stringify({ success: true, updated: count, data: batchResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error("Invalid action");
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
