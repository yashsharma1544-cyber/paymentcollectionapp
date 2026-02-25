import type { Invoice } from "@/lib/invoice";
import { parseSheetData } from "@/lib/invoice";

const FUNCTION_NAME = "google-sheets";

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

export async function fetchInvoices(): Promise<Invoice[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch invoices: ${await response.text()}`);
  return parseSheetData(await response.json());
}

export async function recordPayment(billNo: string, customerName: string, paidAmount: number): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=record`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ billNo, customerName, paidAmount }),
  });
  if (!response.ok) throw new Error(`Failed to record payment: ${await response.text()}`);
}

export interface PaymentAllocation {
  billNo: string;
  customerName: string;
  paidAmount: number;
}

export async function recordBatchPayments(allocations: PaymentAllocation[]): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=record-batch`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ allocations }),
  });
  if (!response.ok) throw new Error(`Failed to record batch payments: ${await response.text()}`);
}

export interface RecordedPayment {
  billNo: string;
  customerName: string;
  paidAmount: number;
  timestamp: string;
}

export async function fetchRecordedPayments(): Promise<RecordedPayment[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-payments`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch recorded payments: ${await response.text()}`);
  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];
  return data.values.slice(1).map((row: string[]) => ({
    billNo: row[0] || "",
    customerName: row[1] || "",
    paidAmount: parseFloat(row[2]?.replace(/[₹,]/g, "") || "0"),
    timestamp: row[3] || "",
  })).filter((p: RecordedPayment) => p.billNo);
}

// ---- Follow-up API ----

export interface FollowUp {
  customerName: string;
  followUpDate: string;
  followUpTime: string;
  remarks: string;
  nextFollowUpDate: string;
  status: string;
  createdAt: string;
  type: string;
}

export async function addFollowUp(params: {
  customerName: string;
  remarks: string;
  nextFollowUpDate: string;
  type?: string;
}): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=add-followup`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`Failed to add follow-up: ${await response.text()}`);
}

export async function fetchFollowUps(): Promise<FollowUp[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-followups`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch follow-ups: ${await response.text()}`);
  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];
  return data.values.slice(1).map((row: string[]) => ({
    customerName: row[0] || "",
    followUpDate: row[1] || "",
    followUpTime: row[2] || "",
    remarks: row[3] || "",
    nextFollowUpDate: row[4] || "",
    status: row[5] || "Pending",
    createdAt: row[6] || "",
    type: row[7] || "Manual",
  })).filter((f: FollowUp) => f.customerName);
}

export async function updateFollowUpStatus(customerName: string, createdAt: string, status: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=update-followup-status`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName, createdAt, status }),
  });
  if (!response.ok) throw new Error(`Failed to update follow-up status: ${await response.text()}`);
}

// ---- WhatsApp Log API ----

export interface WhatsAppLogEntry {
  customerName: string;
  phone: string;
  timestamp: string;
}

export async function logWhatsApp(customerName: string, phone: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=log-whatsapp`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName, phone }),
  });
  if (!response.ok) throw new Error(`Failed to log WhatsApp: ${await response.text()}`);
}

export async function fetchWhatsAppLog(): Promise<WhatsAppLogEntry[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-whatsapp-log`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch WhatsApp log: ${await response.text()}`);
  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];
  return data.values.slice(1).map((row: string[]) => ({
    customerName: row[0] || "",
    phone: row[1] || "",
    timestamp: row[2] || "",
  })).filter((e: WhatsAppLogEntry) => e.customerName);
}
