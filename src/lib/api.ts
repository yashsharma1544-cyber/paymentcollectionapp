import type { Invoice } from "@/lib/invoice";
import { parseSheetData, openingBalanceToInvoice, DATA_CUTOFF_DATE } from "@/lib/invoice";
import { parseDateDMY } from "@/lib/date-utils";


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
  const [invRes, openings, obPayments, phoneOverrides] = await Promise.all([
    fetch(`${baseUrl}?action=fetch`, { headers }),
    fetchOpeningBalances().catch(() => [] as OpeningBalance[]),
    // Pull payments only to net against OB virtual invoices.
    fetchRecordedPayments().catch(() => [] as RecordedPayment[]),
    fetchCustomerPhones().catch(() => ({} as Record<string, string>)),
  ]);
  if (!invRes.ok) throw new Error(`Failed to fetch invoices: ${await invRes.text()}`);
  const invoices = parseSheetData(await invRes.json());

  // Override mobile from CustomerPhones tab
  for (const inv of invoices) {
    const override = phoneOverrides[inv.customerName];
    if (override) inv.mobileNo = override;
  }

  // Derive mobile/beat per customer from existing invoices so opening-balance
  // virtual rows inherit them.
  const meta = new Map<string, { mobileNo: string; beat: string }>();
  for (const inv of invoices) {
    if (!meta.has(inv.customerName)) {
      meta.set(inv.customerName, { mobileNo: inv.mobileNo, beat: inv.beat });
    }
  }

  // Sum payments (paid + discount) recorded against each OB- billNo
  const obPaidMap = new Map<string, number>();
  for (const p of obPayments) {
    if (!p.billNo.startsWith("OB-")) continue;
    obPaidMap.set(p.billNo, (obPaidMap.get(p.billNo) || 0) + p.paidAmount + (p.discount || 0));
  }

  const obInvoices = openings
    .map((ob) => ({ ...ob, openingBalance: Math.abs(ob.openingBalance) }))
    .filter((ob) => ob.openingBalance > 0)
    .map((ob) => {
      const m = meta.get(ob.ledgerName);
      const phoneOverride = phoneOverrides[ob.ledgerName];
      const inv = openingBalanceToInvoice(ob, phoneOverride || m?.mobileNo, m?.beat);
      const paid = obPaidMap.get(inv.billNo) || 0;
      inv.paidAmount = Math.min(paid, inv.billAmount);
      inv.outstandingAmount = Math.max(0, inv.billAmount - paid);
      inv.paymentStatus = inv.outstandingAmount === 0 ? "Paid" : "Pending";
      return inv;
    });


  return [...obInvoices, ...invoices];
}

// ---- Customer Phones (override) ----
export async function fetchCustomerPhones(): Promise<Record<string, string>> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-customer-phones`, { headers });
  if (!response.ok) return {};
  const data = await response.json();
  const rows: string[][] = data.values || [];
  if (rows.length === 0) return {};
  const startIdx = rows[0]?.[0] === "Customer Name" || rows[0]?.[0] === "customerName" ? 1 : 0;
  const map: Record<string, string> = {};
  for (let i = startIdx; i < rows.length; i++) {
    const name = (rows[i][0] || "").trim();
    const mobile = (rows[i][1] || "").trim();
    if (name && mobile) map[name] = mobile;
  }
  return map;
}

export async function upsertCustomerPhone(customerName: string, mobile: string, updatedBy?: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=upsert-customer-phone`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName, mobile, updatedBy }),
  });
  if (!response.ok) throw new Error(`Failed to save mobile: ${await response.text()}`);
}

export interface OpeningBalance {
  ledgerName: string;
  group: string;
  category: string;
  openingBalance: number;
  closingBalance: number;
  netMovement: number;
}

const toNum = (v?: string) =>
  parseFloat((v || "0").toString().replace(/[₹,()\s]/g, "").replace(/^-?$/, "0")) || 0;

export async function fetchOpeningBalances(): Promise<OpeningBalance[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-opening-balances`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch opening balances: ${await response.text()}`);
  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];
  return data.values.slice(1).map((row: string[]) => ({
    ledgerName: row[0] || "",
    group: row[1] || "",
    category: row[2] || "",
    openingBalance: toNum(row[3]),
    closingBalance: toNum(row[4]),
    netMovement: toNum(row[5]),
  })).filter((r: OpeningBalance) => r.ledgerName);
}



export async function recordPayment(billNo: string, customerName: string, paidAmount: number, paymentDate?: string, paymentMode?: string, discount?: number, notes?: string, collectedBy?: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=record`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ billNo, customerName, paidAmount, paymentDate, paymentMode, discount, notes, collectedBy }),
  });
  if (!response.ok) throw new Error(`Failed to record payment: ${await response.text()}`);
}

export interface PaymentAllocation {
  billNo: string;
  customerName: string;
  paidAmount: number;
  paymentDate?: string;
}

export async function recordBatchPayments(allocations: PaymentAllocation[], paymentDate?: string, paymentMode?: string, discount?: number, notes?: string, collectedBy?: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=record-batch`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ allocations, paymentDate, paymentMode, discount, notes, collectedBy }),
  });
  if (!response.ok) throw new Error(`Failed to record batch payments: ${await response.text()}`);
}

export interface RecordedPayment {
  billNo: string;
  customerName: string;
  paidAmount: number;
  timestamp: string;
  paymentDate: string;
  paymentMode: string;
  discount: number;
  notes: string;
  collectedBy: string;
  source: "Opening Balance" | "Bill" | "";
}

export async function fetchRecordedPayments(): Promise<RecordedPayment[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-payments`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch recorded payments: ${await response.text()}`);
  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];
  return data.values.slice(1).map((row: string[]) => {
    const billNo = row[0] || "";
    const rawSource = (row[9] || "").trim();
    const source: RecordedPayment["source"] =
      rawSource === "Opening Balance" ? "Opening Balance"
      : rawSource === "Bill" ? "Bill"
      : billNo.startsWith("OB-") ? "Opening Balance" : "";
    return {
      billNo,
      customerName: row[1] || "",
      paidAmount: parseFloat(row[2]?.replace(/[₹,]/g, "") || "0"),
      timestamp: row[3] || "",
      paymentDate: row[4] || "",
      paymentMode: row[5] || "",
      discount: parseFloat(row[6]?.replace(/[₹,]/g, "") || "0"),
      notes: row[7] || "",
      collectedBy: row[8] || "",
      source,
    };
  }).filter((p: RecordedPayment) => {
    if (!p.billNo) return false;
    // Keep OB payments regardless of date (they apply to the opening balance bucket).
    if (p.billNo.startsWith("OB-")) return true;
    const d = parseDateDMY(p.paymentDate) || parseDateDMY(p.timestamp);
    if (!d) return true; // keep if undated rather than silently dropping
    return d.getTime() >= DATA_CUTOFF_DATE.getTime();
  });

}

export async function editPayment(params: {
  billNo: string;
  originalTimestamp: string;
  customerName?: string;
  paidAmount: number;
  paymentDate?: string;
  paymentMode?: string;
  discount?: number;
  notes?: string;
  collectedBy?: string;
}): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=edit-payment`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`Failed to edit payment: ${await response.text()}`);
}

export async function deletePayment(billNo: string, originalTimestamp: string, customerName?: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=delete-payment`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ billNo, originalTimestamp: originalTimestamp || undefined, customerName }),
  });
  if (!response.ok) throw new Error(`Failed to delete payment: ${await response.text()}`);
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
  addedBy: string;
}

export async function addFollowUp(params: {
  customerName: string;
  remarks: string;
  nextFollowUpDate: string;
  type?: string;
  addedBy?: string;
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
  if (!data.values || data.values.length < 1) return [];
  const startIdx = (data.values[0]?.[0] === "Customer Name" || data.values[0]?.[0] === "customerName") ? 1 : 0;
  return data.values.slice(startIdx).map((row: string[]) => ({
    customerName: row[0] || "",
    followUpDate: row[1] || "",
    followUpTime: row[2] || "",
    remarks: row[3] || "",
    nextFollowUpDate: row[4] || "",
    status: row[5] || "Pending",
    createdAt: row[6] || "",
    type: row[7] || "Manual",
    addedBy: row[8] || "",
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

export async function editFollowUp(params: {
  customerName: string;
  createdAt: string;
  remarks: string;
  nextFollowUpDate: string;
  status: string;
}): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=edit-followup`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`Failed to edit follow-up: ${await response.text()}`);
}

export async function deleteFollowUp(customerName: string, createdAt: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=delete-followup`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName, createdAt }),
  });
  if (!response.ok) throw new Error(`Failed to delete follow-up: ${await response.text()}`);
}

// ---- WhatsApp Log API ----

export interface WhatsAppLogEntry {
  customerName: string;
  phone: string;
  timestamp: string;
  sentBy: string;
}

export async function logWhatsApp(customerName: string, phone: string, sentBy?: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=log-whatsapp`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName, phone, sentBy }),
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
    sentBy: row[3] || "",
  })).filter((e: WhatsAppLogEntry) => e.customerName);
}

// ---- WA Replies API ----

export interface WAReply {
  phone: string;
  contactName: string;
  messageText: string;
  messageType: string;
  direction: string;
  timestamp: string;
  waId: string;
}

export async function fetchWAReplies(): Promise<WAReply[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-wa-replies`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch WA replies: ${await response.text()}`);
  const data = await response.json();
  if (!data.values || data.values.length < 2) return [];
  return data.values.slice(1).map((row: string[]) => ({
    phone: row[0] || "",
    contactName: row[1] || "",
    messageText: row[2] || "",
    messageType: row[3] || "text",
    direction: row[4] || "incoming",
    timestamp: row[5] || "",
    waId: row[6] || "",
  })).filter((r: WAReply) => r.phone || r.contactName);
}

// ---- Stopped Reminders API ----

export async function fetchStoppedReminders(): Promise<string[]> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=fetch-stopped-reminders`, { headers });
  if (!response.ok) throw new Error(`Failed to fetch stopped reminders: ${await response.text()}`);
  const data = await response.json();
  if (!data.values || data.values.length === 0) return [];
  return data.values.map((row: string[]) => row[0]).filter(Boolean);
}

export async function stopReminders(customerName: string, stoppedBy?: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=stop-reminders`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName, stoppedBy }),
  });
  if (!response.ok) throw new Error(`Failed to stop reminders: ${await response.text()}`);
}

export async function resumeReminders(customerName: string): Promise<void> {
  const { baseUrl, headers } = getApiBase();
  const response = await fetch(`${baseUrl}?action=resume-reminders`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ customerName }),
  });
  if (!response.ok) throw new Error(`Failed to resume reminders: ${await response.text()}`);
}
