// app-data: Postgres-backed replacement for the old google-sheets function.
// Same action API + {values: string[][]} response shapes, so the frontend,
// cron and WATi webhook keep working unchanged. Source of truth = daily
// Tally outstanding CSV uploads (overwrite-always per company).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPANIES = ["Sushil Agencies", "Anjali Agencies"];

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---------- helpers ----------
const IST = "Asia/Kolkata";
function fmtDMY(d: string | Date | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  if (isNaN(dt.getTime())) return "";
  // date-only values are stored as plain dates; format without TZ shift
  if (typeof d === "string" && d.length === 10) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }
  return dt.toLocaleDateString("en-GB", { timeZone: IST });
}
function fmtTS(ts: string | null): string {
  if (!ts) return "";
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleString("en-GB", { timeZone: IST, hour12: false }).replace(",", "");
}
function fmtTime(ts: string | null): string {
  if (!ts) return "";
  const dt = new Date(ts);
  return dt.toLocaleTimeString("en-GB", { timeZone: IST, hour12: false, hour: "2-digit", minute: "2-digit" });
}
function parseDMYtoISO(s?: string): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) {
    // already ISO?
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  }
  const [, d, mo, y] = m;
  const yyyy = y.length === 2 ? "20" + y : y;
  return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function normPhone(p: string): string {
  return (p || "").replace(/[\s\-()+]/g, "").replace(/^91(?=\d{10}$)/, "");
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function bad(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}
async function findPaymentByKey(billNo: string, originalTimestamp: string, customerName?: string) {
  let q = db.from("payments").select("*").eq("bill_no", billNo);
  if (customerName) q = q.eq("customer_name", customerName);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  if (!originalTimestamp) return data[0];
  return data.find((p) => fmtTS(p.created_at) === originalTimestamp) ?? null;
}
async function adjustOutstandingPaid(billNo: string, customerName: string | null, delta: number) {
  let q = db.from("outstanding").select("id, bill_amount, paid_amount").eq("bill_no", billNo);
  if (customerName) q = q.eq("customer_name", customerName);
  const { data } = await q.limit(1);
  if (!data || data.length === 0) return;
  const row = data[0];
  const paid = Number(row.paid_amount || 0) + delta;
  const status = paid >= Number(row.bill_amount) - 0.01 ? "Paid" : "Pending";
  await db.from("outstanding").update({
    paid_amount: paid,
    status,
    last_app_update: new Date().toISOString(),
  }).eq("id", row.id);
}

// ---------- server ----------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "GET" ? "fetch" : null);
    if (!action) return bad("Missing action");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ---------- invoices ----------
    if (action === "fetch") {
      const [billsRes, custRes] = await Promise.all([
        db.from("outstanding")
          .select("bill_no, customer_name, company, bill_date, bill_amount, paid_amount, due_date, overdue_days, status")
          .order("customer_name")
          .limit(50000),
        db.from("customers").select("name, mobile, beat").limit(50000),
      ]);
      if (billsRes.error) throw billsRes.error;
      if (custRes.error) throw custRes.error;
      const custMap = new Map((custRes.data ?? []).map((c) => [c.name, c]));
      const data = billsRes.data;
      const values: string[][] = [[
        "Bill No", "Customer Name", "Mobile", "Company", "Bill Date",
        "Bill Amount", "Paid Amount", "Outstanding", "Due Date", "Overdue Days", "Status", "Beat",
      ]];
      for (const r of data ?? []) {
        const bill = Number(r.bill_amount || 0);
        const paid = Number(r.paid_amount || 0);
        const cust = custMap.get(r.customer_name ?? "") as { mobile?: string; beat?: string } | undefined;
        values.push([
          r.bill_no ?? "",
          r.customer_name ?? "",
          cust?.mobile ?? "",
          r.company ?? "",
          fmtDMY(r.bill_date),
          String(bill),
          String(paid),
          String(bill - paid),
          fmtDMY(r.due_date),
          String(r.overdue_days ?? 0),
          r.status ?? "Pending",
          cust?.beat || "Unassigned",
        ]);
      }
      return json({ values });
    }

    if (action === "fetch-opening-balances") {
      return json({ values: [] }); // Tally snapshot already includes all old dues
    }

    // ---------- upload (overwrite-always per company) ----------
    if (action === "upload-outstanding") {
      const { company, asOnDate, rows, uploadedBy } = body as {
        company: string;
        asOnDate: string;
        rows: Array<{ customer: string; ref: string; billDate?: string; pending: number; dueDate?: string; overdue?: number }>;
        uploadedBy?: string;
      };
      if (!COMPANIES.includes(company)) return bad(`company must be one of: ${COMPANIES.join(", ")}`);
      if (!Array.isArray(rows) || rows.length === 0) return bad("rows is empty");
      const asOn = parseDMYtoISO(asOnDate) ?? new Date().toISOString().slice(0, 10);

      // Which customers are new?
      const names = [...new Set(rows.map((r) => (r.customer || "").trim()).filter(Boolean))];
      const { data: existing, error: exErr } = await db.from("customers").select("name").in("name", names);
      if (exErr) throw exErr;
      const known = new Set((existing ?? []).map((c) => c.name));
      const newNames = names.filter((n) => !known.has(n));
      if (newNames.length > 0) {
        const { error } = await db.from("customers")
          .insert(newNames.map((n) => ({ name: n, mobile: "", beat: "Unassigned" })));
        if (error) throw error;
      }

      // Overwrite this company's snapshot
      const { error: delErr } = await db.from("outstanding").delete().eq("company", company);
      if (delErr) throw delErr;

      const inserts = rows.map((r) => ({
        bill_no: (r.ref || "").trim() || `NA-${crypto.randomUUID().slice(0, 8)}`,
        customer_name: (r.customer || "").trim(),
        company,
        bill_date: parseDMYtoISO(r.billDate) ?? asOn,
        bill_amount: Number(r.pending) || 0,
        paid_amount: 0,
        due_date: parseDMYtoISO(r.dueDate) ?? parseDMYtoISO(r.billDate) ?? asOn,
        overdue_days: Number(r.overdue) || 0,
        status: "Pending",
        as_on_date: asOn,
        sync_source: "tally-csv",
        last_source_sync: new Date().toISOString(),
      }));
      for (let i = 0; i < inserts.length; i += 500) {
        const { error } = await db.from("outstanding").insert(inserts.slice(i, i + 500));
        if (error) throw error;
      }
      const totalPending = inserts.reduce((s, r) => s + r.bill_amount, 0);
      await db.from("upload_log").insert({
        company,
        as_on_date: asOn,
        bills_count: inserts.length,
        customers_count: names.length,
        total_pending: totalPending,
        new_customers: newNames.length,
        uploaded_by: uploadedBy ?? null,
      });
      return json({ ok: true, inserted: inserts.length, customers: names.length, totalPending, newCustomers: newNames });
    }

    if (action === "fetch-upload-log") {
      const { data, error } = await db.from("upload_log").select("*").order("uploaded_at", { ascending: false }).limit(30);
      if (error) throw error;
      const values = [["Company", "As On", "Bills", "Customers", "Total Pending", "New Customers", "Uploaded At"]];
      for (const r of data ?? []) {
        values.push([r.company, fmtDMY(r.as_on_date), String(r.bills_count), String(r.customers_count), String(r.total_pending), String(r.new_customers), fmtTS(r.uploaded_at)]);
      }
      return json({ values });
    }

    // ---------- customers / phones ----------
    if (action === "fetch-customer-phones") {
      const { data, error } = await db.from("customers").select("name, mobile").neq("mobile", "").order("name");
      if (error) throw error;
      const values = [["Customer Name", "Mobile"], ...(data ?? []).map((c) => [c.name, c.mobile])];
      return json({ values });
    }
    if (action === "upsert-customer-phone") {
      const { customerName, mobile } = body as { customerName: string; mobile: string };
      if (!customerName) return bad("Missing customerName");
      const { error } = await db.from("customers").upsert(
        { name: customerName, mobile: mobile ?? "", updated_at: new Date().toISOString() },
        { onConflict: "name" },
      );
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "update-customer-beat") {
      const { customerName, beat } = body as { customerName: string; beat: string };
      if (!customerName) return bad("Missing customerName");
      const { error } = await db.from("customers").upsert(
        { name: customerName, beat: beat || "Unassigned", updated_at: new Date().toISOString() },
        { onConflict: "name" },
      );
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "lookup-customer") {
      const phone = url.searchParams.get("phone");
      if (!phone) return bad("Missing phone parameter");
      const target = normPhone(phone);
      const { data, error } = await db.from("customers").select("name, mobile").neq("mobile", "");
      if (error) throw error;
      const hit = (data ?? []).find((c) => normPhone(c.mobile) === target);
      return json({ customerName: hit?.name ?? null });
    }

    // ---------- payments ----------
    if (action === "record" || action === "record-batch") {
      const allocations = action === "record"
        ? [{ billNo: body.billNo, customerName: body.customerName, paidAmount: body.paidAmount, paymentDate: body.paymentDate }]
        : (body.allocations ?? []);
      if (!allocations.length) return bad("No allocations");
      for (const a of allocations) {
        const paid = Number(a.paidAmount) || 0;
        const discount = Number(body.discount) || 0;
        // look up company from the bill
        const { data: billRows } = await db.from("outstanding").select("company")
          .eq("bill_no", a.billNo).eq("customer_name", a.customerName).limit(1);
        const { error } = await db.from("payments").insert({
          bill_no: a.billNo,
          customer_name: a.customerName,
          paid_amount: paid,
          payment_date: parseDMYtoISO(a.paymentDate ?? body.paymentDate) ?? new Date().toISOString().slice(0, 10),
          payment_mode: body.paymentMode ?? "",
          discount,
          notes: body.notes ?? "",
          collected_by: body.collectedBy ?? "",
          company: billRows?.[0]?.company ?? "",
        });
        if (error) throw error;
        await adjustOutstandingPaid(a.billNo, a.customerName, paid + discount);
      }
      return json({ ok: true });
    }

    if (action === "fetch-payments") {
      const { data, error } = await db.from("payments").select("*").order("created_at", { ascending: false }).limit(20000);
      if (error) throw error;
      const values = [["Bill No", "Customer Name", "Paid Amount", "Timestamp", "Payment Date", "Payment Mode", "Discount", "Notes", "Collected By", "Source"]];
      for (const p of data ?? []) {
        values.push([
          p.bill_no ?? "", p.customer_name ?? "", String(p.paid_amount ?? 0), fmtTS(p.created_at),
          fmtDMY(p.payment_date), p.payment_mode ?? "", String(p.discount ?? 0), p.notes ?? "", p.collected_by ?? "", "Bill",
        ]);
      }
      return json({ values });
    }

    if (action === "edit-payment") {
      const p = await findPaymentByKey(body.billNo, body.originalTimestamp, body.customerName);
      if (!p) return bad("Payment not found", 404);
      const oldEffect = Number(p.paid_amount || 0) + Number(p.discount || 0);
      const newPaid = Number(body.paidAmount) || 0;
      const newDiscount = body.discount !== undefined ? Number(body.discount) || 0 : Number(p.discount || 0);
      const { error } = await db.from("payments").update({
        paid_amount: newPaid,
        payment_date: parseDMYtoISO(body.paymentDate) ?? p.payment_date,
        payment_mode: body.paymentMode ?? p.payment_mode,
        discount: newDiscount,
        notes: body.notes ?? p.notes,
        collected_by: body.collectedBy ?? p.collected_by,
      }).eq("id", p.id);
      if (error) throw error;
      await adjustOutstandingPaid(p.bill_no, p.customer_name, newPaid + newDiscount - oldEffect);
      return json({ ok: true });
    }

    if (action === "delete-payment") {
      const p = await findPaymentByKey(body.billNo, body.originalTimestamp, body.customerName);
      if (!p) return bad("Payment not found", 404);
      const { error } = await db.from("payments").delete().eq("id", p.id);
      if (error) throw error;
      await adjustOutstandingPaid(p.bill_no, p.customer_name, -(Number(p.paid_amount || 0) + Number(p.discount || 0)));
      return json({ ok: true });
    }

    // ---------- follow-ups ----------
    if (action === "add-followup") {
      const { customerName, remarks, nextFollowUpDate, type, addedBy } = body;
      if (!customerName) return bad("Missing customerName");
      const { error } = await db.from("follow_ups").insert({
        customer: customerName,
        note: remarks ?? "",
        next_follow_up_date: parseDMYtoISO(nextFollowUpDate),
        status: "Pending",
        source: type ?? "Manual",
        added_by: addedBy ?? "",
      });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "fetch-followups") {
      const { data, error } = await db.from("follow_ups").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const values = [["Customer Name", "Follow Up Date", "Time", "Remarks", "Next Follow Up", "Status", "Created At", "Type", "Added By"]];
      for (const f of data ?? []) {
        values.push([
          f.customer ?? "", fmtDMY(f.created_at?.slice(0, 10)), fmtTime(f.created_at), f.note ?? "",
          fmtDMY(f.next_follow_up_date), f.status ?? "Pending", fmtTS(f.created_at), f.source ?? "Manual", f.added_by ?? "",
        ]);
      }
      return json({ values });
    }
    if (action === "update-followup-status" || action === "edit-followup" || action === "delete-followup") {
      const { customerName, createdAt } = body;
      const { data, error } = await db.from("follow_ups").select("*").eq("customer", customerName).limit(500);
      if (error) throw error;
      const f = (data ?? []).find((x) => fmtTS(x.created_at) === createdAt) ?? (data ?? [])[0];
      if (!f) return bad("Follow-up not found", 404);
      if (action === "delete-followup") {
        await db.from("follow_ups").delete().eq("id", f.id);
      } else if (action === "update-followup-status") {
        await db.from("follow_ups").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", f.id);
      } else {
        await db.from("follow_ups").update({
          note: body.remarks ?? f.note,
          next_follow_up_date: parseDMYtoISO(body.nextFollowUpDate) ?? f.next_follow_up_date,
          status: body.status ?? f.status,
          updated_at: new Date().toISOString(),
        }).eq("id", f.id);
      }
      return json({ ok: true });
    }

    // ---------- WhatsApp log / replies ----------
    if (action === "log-whatsapp") {
      const { customerName, phone, sentBy } = body;
      const { error } = await db.from("whatsapp_log").insert({
        customer: customerName ?? "", phone: phone ?? "", sent_by: sentBy ?? "", status: "sent",
      });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "fetch-whatsapp-log") {
      const { data, error } = await db.from("whatsapp_log").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const values = [["Customer Name", "Phone", "Timestamp", "Sent By"]];
      for (const w of data ?? []) values.push([w.customer ?? "", w.phone ?? "", fmtTS(w.created_at), w.sent_by ?? ""]);
      return json({ values });
    }
    if (action === "log-wa-reply") {
      const { phone, contactName, messageText, messageType, direction, waId, waMessageId } = body;
      const { error } = await db.from("wa_replies").insert({
        phone: phone ?? "", contact_name: contactName ?? "", message_text: messageText ?? "",
        message_type: messageType ?? "text", direction: direction ?? "incoming",
        wa_id: waId ?? "", wa_message_id: waMessageId ?? "",
      });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "fetch-wa-replies") {
      const { data, error } = await db.from("wa_replies").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const values = [["Phone", "Contact Name", "Message", "Type", "Direction", "Timestamp", "WA ID"]];
      for (const r of data ?? []) {
        values.push([r.phone ?? "", r.contact_name ?? "", r.message_text ?? "", r.message_type ?? "text", r.direction ?? "incoming", fmtTS(r.created_at), r.wa_id ?? ""]);
      }
      return json({ values });
    }

    // ---------- stopped reminders ----------
    if (action === "fetch-stopped-reminders") {
      const { data, error } = await db.from("stopped_reminders").select("customer").order("created_at", { ascending: false });
      if (error) throw error;
      return json({ values: (data ?? []).map((r) => [r.customer]) });
    }
    if (action === "stop-reminders") {
      const { error } = await db.from("stopped_reminders").insert({ customer: body.customerName, stopped_by: body.stoppedBy ?? "" });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "resume-reminders") {
      const { error } = await db.from("stopped_reminders").delete().eq("customer", body.customerName);
      if (error) throw error;
      return json({ ok: true });
    }

    return bad(`Unknown action: ${action}`);
  } catch (err) {
    console.error("app-data error:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
