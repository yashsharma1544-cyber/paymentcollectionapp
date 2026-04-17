const FUNCTION_NAME = "claude-insights";

function getApiBase() {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    url: `https://${projectId}.supabase.co/functions/v1/${FUNCTION_NAME}`,
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
  };
}

export interface CustomerInsight {
  headline: string;
  behavior: string;
  risk: "low" | "medium" | "high";
  risk_reason: string;
  recommendations: string[];
  talking_points: string[];
  _cached?: boolean;
  _generated_at?: string;
}

export interface DailyBrief {
  greeting: string;
  headline: string;
  priorities: string[];
  opportunities: string[];
  warnings: string[];
  metrics_note: string;
  _cached?: boolean;
  _generated_at?: string;
}

export interface AiError {
  error: string;
  code?: string;
}

async function callFn(body: Record<string, unknown>): Promise<any> {
  const { url, headers } = getApiBase();
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: "Invalid response" }));
  if (!res.ok) {
    const err: AiError = { error: data?.error || `Request failed (${res.status})`, code: data?.code };
    throw err;
  }
  return data;
}

export async function getCustomerInsight(customerName: string, forceRefresh = false): Promise<CustomerInsight> {
  return await callFn({ action: "customer-insight", customer_name: customerName, force_refresh: forceRefresh });
}

export async function getDailyBrief(userName: string, forceRefresh = false): Promise<DailyBrief> {
  return await callFn({ action: "daily-brief", user_name: userName, force_refresh: forceRefresh });
}
