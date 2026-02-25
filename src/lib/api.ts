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
