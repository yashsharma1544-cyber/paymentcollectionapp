const FUNCTION_NAME = "wati";

function getApiBase() {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    baseUrl: `https://${projectId}.supabase.co/functions/v1/${FUNCTION_NAME}`,
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
  };
}

export async function sendWatiSessionMessage(phone: string, message: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=send-session-message`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  });
  const data = await response.json();
  if (!response.ok) return { success: false, error: data.error || "Failed to send message" };
  return { success: true, data };
}

export async function sendWatiTemplateMessage(
  phone: string,
  templateName: string,
  parameters?: { name: string; value: string }[],
  broadcastName?: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=send-template-message`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, templateName, parameters, broadcastName }),
  });
  const data = await response.json();
  if (!response.ok) return { success: false, error: data.error || "Failed to send template" };
  return { success: true, data };
}

export async function sendWatiTextMessage(phone: string, message: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=send-text-message`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  });
  const data = await response.json();
  if (!response.ok) return { success: false, error: data.error || "Failed to send message" };
  return { success: true, data };
}

export interface WatiMessage {
  id: string;
  text: string;
  type: string;
  time: string;
  owner: boolean;
  statusString: string;
  failedDetail?: string;
}

export async function getWatiMessages(phone: string): Promise<WatiMessage[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=get-messages&phone=${encodeURIComponent(phone)}`, { headers });
  if (!response.ok) throw new Error("Failed to fetch messages");
  const data = await response.json();
  const items = data.messages?.items || [];
  // Filter and normalize: keep only actual messages and broadcast messages, skip ticket events
  return items
    .filter((item: any) => item.eventType === "message" || item.eventType === "broadcastMessage")
    .map((item: any) => ({
      id: item.id,
      text: item.text || item.finalText || "",
      type: item.type || item.eventType || "text",
      time: item.created || "",
      owner: item.owner ?? (item.eventType === "broadcastMessage"),
      statusString: item.statusString || "",
      failedDetail: item.failedDetail || "",
    }));
}
