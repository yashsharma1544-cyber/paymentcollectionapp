import type { Invoice } from "@/lib/invoice";
import { parseSheetData } from "@/lib/invoice";

const FUNCTION_NAME = "google-sheets";

export async function fetchInvoices(): Promise<Invoice[]> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/${FUNCTION_NAME}?action=fetch`,
    {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch invoices: ${errText}`);
  }

  const sheetData = await response.json();
  return parseSheetData(sheetData);
}

export async function recordPayment(
  billNo: string,
  customerName: string,
  paidAmount: number
): Promise<void> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/${FUNCTION_NAME}?action=record`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billNo, customerName, paidAmount }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to record payment: ${errText}`);
  }
}

export interface PaymentAllocation {
  billNo: string;
  customerName: string;
  paidAmount: number;
}

export async function recordBatchPayments(
  allocations: PaymentAllocation[]
): Promise<void> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/${FUNCTION_NAME}?action=record-batch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ allocations }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to record batch payments: ${errText}`);
  }
}

export interface RecordedPayment {
  billNo: string;
  customerName: string;
  paidAmount: number;
  timestamp: string;
}

export async function fetchRecordedPayments(): Promise<RecordedPayment[]> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/${FUNCTION_NAME}?action=fetch-payments`,
    {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch recorded payments: ${errText}`);
  }

  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];

  return data.values.slice(1).map((row: string[]) => ({
    billNo: row[0] || "",
    customerName: row[1] || "",
    paidAmount: parseFloat(row[2]?.replace(/[₹,]/g, "") || "0"),
    timestamp: row[3] || "",
  })).filter((p: RecordedPayment) => p.billNo);
}
