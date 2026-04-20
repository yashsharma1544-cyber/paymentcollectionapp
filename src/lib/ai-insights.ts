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

export type AiProvider = "claude" | "gemini" | "gpt";

export const AI_PROVIDERS: { value: AiProvider; label: string; hint: string }[] = [
  { value: "gemini", label: "Gemini", hint: "Google · Fast & free" },
  { value: "gpt", label: "ChatGPT", hint: "OpenAI GPT-5 mini" },
  { value: "claude", label: "Claude", hint: "Anthropic Haiku" },
];

const PROVIDER_KEY = "ai_provider";

export function getProvider(): AiProvider {
  if (typeof window === "undefined") return "gemini";
  const v = window.localStorage.getItem(PROVIDER_KEY) as AiProvider | null;
  return v && ["claude", "gemini", "gpt"].includes(v) ? v : "gemini";
}

export function setProvider(p: AiProvider) {
  if (typeof window !== "undefined") window.localStorage.setItem(PROVIDER_KEY, p);
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
  _provider?: AiProvider;
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
  _provider?: AiProvider;
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

export async function getCustomerInsight(customerName: string, forceRefresh = false, provider?: AiProvider): Promise<CustomerInsight> {
  return await callFn({ action: "customer-insight", customer_name: customerName, force_refresh: forceRefresh, provider: provider || getProvider() });
}

export async function getDailyBrief(userName: string, forceRefresh = false, provider?: AiProvider): Promise<DailyBrief> {
  return await callFn({ action: "daily-brief", user_name: userName, force_refresh: forceRefresh, provider: provider || getProvider() });
}
