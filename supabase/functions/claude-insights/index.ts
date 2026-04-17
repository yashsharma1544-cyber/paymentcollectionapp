import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPREADSHEET_ID = "1IH-MYfQi324eMeiPXD5otZz_9trPlVUDBJViTgVWEuI";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

// ---------- Google Sheets helpers ----------
function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claim = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const signingInput = `${header}.${claim}`;
  const pem = sa.private_key.replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binKey = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function readSheet(accessToken: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.values || [];
}

// ---------- Date helpers ----------
function parseDMY(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ---------- Cache ----------
async function getCached(supabase: any, cacheKey: string): Promise<any | null> {
  const { data } = await supabase
    .from("ai_insights_cache")
    .select("content, generated_at, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return { ...data.content, _cached: true, _generated_at: data.generated_at };
}

async function setCached(supabase: any, cacheKey: string, kind: string, content: any, rawStats: any, ttlSeconds: number, tokens: number) {
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await supabase.from("ai_insights_cache").upsert({
    cache_key: cacheKey,
    kind,
    content,
    raw_stats: rawStats,
    generated_at: new Date().toISOString(),
    expires_at: expires,
    tokens_used: tokens,
  }, { onConflict: "cache_key" });
}

// ---------- Claude call ----------
async function callClaude(apiKey: string, system: string, userMsg: string): Promise<{ json: any; tokens: number }> {
  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude error ${res.status}: ${JSON.stringify(data)}`);
  const text = data.content?.[0]?.text || "";
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error(`Claude returned non-JSON: ${text.slice(0, 200)}`);
  }
  const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  return { json: parsed, tokens };
}

// ---------- Customer insight ----------
const CUSTOMER_SYSTEM = `You are a sharp business analyst for **Sushil Agencies**, an FMCG distributor in Jalna, Maharashtra. The user is a field salesman who needs practical guidance on how to deal with a specific kirana (retail) customer to recover udhaar (credit).

Use crisp English. Sprinkle natural Hindi/Marathi business phrasing where it actually fits — words like *kirana*, *udhaar*, *bhaisahab*, *paisa*, *seth*, *thoda*, *pakka*, *abhi* — but only when natural. Do not force it.

Be practical, not academic. A working salesman should read this and know what to do today.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown fences. No prose wrapper. No commentary.
- Base everything on the provided data. Do NOT invent facts, names, dates, or amounts.
- If historical payments < 3, mention "thin data" or "limited history" in the behavior section.
- Risk must be one of: "low", "medium", "high".

JSON shape:
{
  "headline": "one-line summary (max 100 chars)",
  "behavior": "2-3 sentences on payment pattern, reliability, and any red/green flags",
  "risk": "low" | "medium" | "high",
  "risk_reason": "1 sentence explaining the risk level",
  "recommendations": ["3-4 short actionable items, each max 80 chars"],
  "talking_points": ["3-4 natural phrases the salesman can use when calling/visiting, with Hindi/Marathi where it fits"]
}`;

async function buildCustomerStats(accessToken: string, customerName: string) {
  const [outstandingRows, paymentRows, followupRows, waRows] = await Promise.all([
    readSheet(accessToken, "Outstanding!A1:Z5000"),
    readSheet(accessToken, "Record Payments!A1:Z10000"),
    readSheet(accessToken, "Follow Ups!A1:Z5000"),
    readSheet(accessToken, "WhatsApp Log!A1:Z10000"),
  ]);

  const invoices = outstandingRows.slice(1)
    .filter((r) => r[1] === customerName && r[0])
    .map((r) => ({
      billNo: r[0],
      billDate: r[4] || "",
      billAmount: Math.round(parseFloat((r[5] || "0").replace(/[₹,]/g, "")) || 0),
      paidAmount: Math.round(parseFloat((r[6] || "0").replace(/[₹,]/g, "")) || 0),
      outstanding: Math.round(parseFloat((r[7] || "0").replace(/[₹,]/g, "")) || 0),
      dueDate: r[8] || "",
      beat: r[11] || "",
    }));

  const payments = paymentRows.slice(1)
    .filter((r) => r[1] === customerName && r[0])
    .map((r) => ({
      billNo: r[0],
      paidAmount: parseFloat((r[2] || "0").replace(/[₹,]/g, "")) || 0,
      timestamp: r[3] || "",
      paymentDate: r[4] || "",
      mode: r[5] || "",
      collectedBy: r[8] || "",
    }));

  const followups = followupRows.slice(1)
    .filter((r) => r[0] === customerName)
    .map((r) => ({
      date: r[1] || "",
      remarks: r[3] || "",
      nextDate: r[4] || "",
      status: r[5] || "",
    }));

  const waLog = waRows.slice(1)
    .filter((r) => r[0] === customerName)
    .map((r) => ({ timestamp: r[2] || "", sentBy: r[3] || "" }));

  const billDateMap = new Map<string, Date | null>();
  invoices.forEach((i) => billDateMap.set(i.billNo, parseDMY(i.billDate)));

  const collectionDays: number[] = [];
  payments.forEach((p) => {
    const billD = billDateMap.get(p.billNo);
    const payD = parseDMY(p.paymentDate);
    if (billD && payD) {
      const d = daysBetween(billD, payD);
      if (d >= 0 && d < 365) collectionDays.push(d);
    }
  });
  const avgCollectionDays = collectionDays.length
    ? Math.round(collectionDays.reduce((a, b) => a + b, 0) / collectionDays.length)
    : null;

  const sortedDays = [...collectionDays];
  const recent = sortedDays.slice(-3);
  const earlier = sortedDays.slice(0, -3);
  const recentAvg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null;
  const earlierAvg = earlier.length ? Math.round(earlier.reduce((a, b) => a + b, 0) / earlier.length) : null;
  let trend: "improving" | "worsening" | "stable" | "unknown" = "unknown";
  if (recentAvg !== null && earlierAvg !== null) {
    if (recentAvg < earlierAvg - 3) trend = "improving";
    else if (recentAvg > earlierAvg + 3) trend = "worsening";
    else trend = "stable";
  }

  const now = new Date();
  const totalOutstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
  const overdueInvoices = invoices.filter((i) => {
    const bd = parseDMY(i.billDate);
    if (!bd || i.outstanding <= 0) return false;
    return daysBetween(bd, now) > 21;
  });
  const maxOverdueDays = overdueInvoices.reduce((mx, i) => {
    const bd = parseDMY(i.billDate);
    return bd ? Math.max(mx, daysBetween(bd, now)) : mx;
  }, 0);

  const lastPayment = payments[payments.length - 1];
  const lastFollowup = followups[followups.length - 1];
  const lastWA = waLog[waLog.length - 1];

  return {
    customer_name: customerName,
    today: todayDMY(),
    beat: invoices[0]?.beat || "",
    invoices_total: invoices.length,
    invoices_unpaid: invoices.filter((i) => i.outstanding > 0).length,
    total_outstanding: totalOutstanding,
    max_overdue_days: maxOverdueDays,
    payment_count: payments.length,
    avg_collection_days: avgCollectionDays,
    recent_avg_collection_days: recentAvg,
    earlier_avg_collection_days: earlierAvg,
    payment_trend: trend,
    last_payment: lastPayment ? { date: lastPayment.paymentDate, amount: lastPayment.paidAmount, mode: lastPayment.mode } : null,
    last_followup: lastFollowup ? { date: lastFollowup.date, remarks: lastFollowup.remarks, status: lastFollowup.status } : null,
    last_whatsapp: lastWA ? { timestamp: lastWA.timestamp, sentBy: lastWA.sentBy } : null,
    recent_followup_remarks: followups.slice(-5).map((f) => f.remarks).filter(Boolean),
  };
}

// ---------- Daily brief ----------
const DAILY_SYSTEM = `You are a senior advisor briefing the team at **Sushil Agencies**, an FMCG distributor in Jalna, Maharashtra. The reader is a salesman or owner starting their day.

Use crisp English with natural Hindi/Marathi business phrasing where it fits — *kirana*, *udhaar*, *paisa*, *bhaisahab*, *seth*, *thoda*, *pakka*, *abhi*. Don't force it.

Tone: practical, energetic, like a smart colleague — not a McKinsey report.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown fences. No prose wrapper.
- Base everything on the provided portfolio data. Never invent customer names or amounts.
- Always mention specific customer names from the provided data when calling out priorities/risks.

JSON shape:
{
  "greeting": "warm short greeting referencing the user by name if given (max 80 chars)",
  "headline": "one-line summary of today's situation (max 120 chars)",
  "priorities": ["3-5 specific must-do items today, mention customer names where relevant"],
  "opportunities": ["2-3 wins to chase — customers about to clear, easy collections"],
  "warnings": ["2-3 risks — escalating defaulters, slipping accounts"],
  "metrics_note": "1-2 sentences on overall portfolio health vs typical"
}`;

async function buildDailyStats(accessToken: string, userName: string) {
  const [outstandingRows, paymentRows, followupRows] = await Promise.all([
    readSheet(accessToken, "Outstanding!A1:Z5000"),
    readSheet(accessToken, "Record Payments!A1:Z10000"),
    readSheet(accessToken, "Follow Ups!A1:Z5000"),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const invoices = outstandingRows.slice(1).filter((r) => r[0]).map((r) => ({
    customerName: r[1] || "",
    billDate: r[4] || "",
    outstanding: Math.round(parseFloat((r[7] || "0").replace(/[₹,]/g, "")) || 0),
    beat: r[11] || "",
  }));

  const custMap = new Map<string, { outstanding: number; maxOverdue: number; beat: string; bills: number }>();
  invoices.forEach((i) => {
    if (i.outstanding <= 0) return;
    const bd = parseDMY(i.billDate);
    const overdue = bd ? daysBetween(bd, now) : 0;
    const cur = custMap.get(i.customerName) || { outstanding: 0, maxOverdue: 0, beat: i.beat, bills: 0 };
    cur.outstanding += i.outstanding;
    cur.maxOverdue = Math.max(cur.maxOverdue, overdue);
    cur.bills += 1;
    custMap.set(i.customerName, cur);
  });

  const customers = Array.from(custMap.entries())
    .map(([name, v]) => ({ name, ...v, risk_score: v.outstanding * Math.max(1, v.maxOverdue / 10) }))
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 30)
    .map((c) => ({ name: c.name, outstanding: c.outstanding, max_overdue_days: c.maxOverdue, beat: c.beat, bills: c.bills }));

  const totalOutstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
  const totalDefaulters = Array.from(custMap.values()).filter((v) => v.maxOverdue > 21).length;
  const totalCustomersUnpaid = custMap.size;

  const recentPayments = paymentRows.slice(1).filter((r) => {
    const pd = parseDMY(r[4] || "");
    return pd && pd >= thirtyDaysAgo;
  });
  const last30Total = recentPayments.reduce((s, r) => s + (parseFloat((r[2] || "0").replace(/[₹,]/g, "")) || 0), 0);
  const last30Count = recentPayments.length;

  const pendingFollowups = followupRows.slice(1)
    .filter((r) => {
      const status = (r[5] || "").toLowerCase();
      if (status === "done") return false;
      const next = parseDMY(r[4] || "");
      return next && next <= now;
    })
    .slice(0, 15)
    .map((r) => ({ customer: r[0], next_date: r[4], remarks: r[3], status: r[5] }));

  return {
    user_name: userName,
    today: todayDMY(),
    portfolio: {
      total_outstanding: totalOutstanding,
      customers_with_dues: totalCustomersUnpaid,
      defaulters_over_21d: totalDefaulters,
      payments_last_30d_total: Math.round(last30Total),
      payments_last_30d_count: last30Count,
    },
    top_30_risky_customers: customers,
    pending_followups_due: pendingFollowups,
  };
}

// ---------- Handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, customer_name, user_name, force_refresh } = body || {};

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SA_RAW = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured yet", code: "MISSING_KEY" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!SA_RAW) {
      return new Response(JSON.stringify({ error: "Google service account not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const sa = JSON.parse(SA_RAW);
    const accessToken = await getAccessToken(sa);

    if (action === "customer-insight") {
      if (!customer_name) {
        return new Response(JSON.stringify({ error: "customer_name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cacheKey = `customer:${customer_name}`;
      if (!force_refresh) {
        const cached = await getCached(supabase, cacheKey);
        if (cached) {
          return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      const stats = await buildCustomerStats(accessToken, customer_name);
      const userMsg = `Analyze this customer for the salesman's next visit/call. Data:\n\n${JSON.stringify(stats, null, 2)}`;
      const { json, tokens } = await callClaude(ANTHROPIC_API_KEY, CUSTOMER_SYSTEM, userMsg);
      await setCached(supabase, cacheKey, "customer-insight", json, stats, 7 * 24 * 60 * 60, tokens);
      return new Response(JSON.stringify({ ...json, _cached: false, _generated_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "daily-brief") {
      const u = user_name || "Team";
      const today = todayDMY();
      const cacheKey = `daily-brief:${today}:${u}`;
      if (!force_refresh) {
        const cached = await getCached(supabase, cacheKey);
        if (cached) {
          return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      const stats = await buildDailyStats(accessToken, u);
      const userMsg = `Produce today's brief for ${u}. Portfolio data:\n\n${JSON.stringify(stats, null, 2)}`;
      const { json, tokens } = await callClaude(ANTHROPIC_API_KEY, DAILY_SYSTEM, userMsg);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const ttl = Math.max(60, Math.floor((endOfDay.getTime() - Date.now()) / 1000));
      await setCached(supabase, cacheKey, "daily-brief", json, stats, ttl, tokens);
      return new Response(JSON.stringify({ ...json, _cached: false, _generated_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'customer-insight' or 'daily-brief'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("claude-insights error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
