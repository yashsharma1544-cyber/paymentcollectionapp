import type { OutstandingRow } from "@/lib/api";

/** Result of parsing a Biz Analyst "Outstanding" CSV export. */
export interface ParsedOutstanding {
  rows: OutstandingRow[];
  customerCount: number;
  totalPending: number;
  /** Per-customer checksum failures (parsed sum vs reported Total). Empty = clean. */
  mismatches: { customer: string; parsed: number; reported: number }[];
}

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** "05 OCT 24" -> "05/10/2024" (DD/MM/YYYY) */
function tallyDateToDMY(s: string): string {
  const m = s.trim().match(/^(\d{2}) ([A-Z]{3}) (\d{2})$/);
  if (!m) return "";
  const [, d, mon, y] = m;
  const mm = MONTHS[mon];
  if (!mm) return "";
  return `${d}/${mm}/20${y}`;
}

function toNumber(s: string): number {
  const v = parseFloat((s || "").replace(/[₹,\s]/g, ""));
  return isNaN(v) ? 0 : v;
}

/** Minimal RFC-4180-ish CSV line splitter (handles quoted cells with commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Parse the Biz Analyst outstanding CSV.
 * Structure per customer block:
 *   ,,CUSTOMER NAME
 *   Date,Ref. No.,Pending Amount,Due Date,Overdue by days
 *   "05 OCT 24","OCS/24-25/80","35,760","05 OCT 24","647"
 *   ,Total:,35760.0
 */
export function parseOutstandingCsv(text: string): ParsedOutstanding {
  const rows: OutstandingRow[] = [];
  const reported: Record<string, number> = {};
  let cur: string | null = null;

  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const cells = splitCsvLine(rawLine);
    if (cells.every((c) => !c)) continue;

    // Customer header: ,,NAME
    if (cells.length >= 3 && !cells[0] && !cells[1] && cells[2] && cells[2] !== "Total:") {
      cur = cells[2];
      continue;
    }
    if (cells[0] === "Date") continue;
    // Per-customer total: ,Total:,35760.0
    if (cells.length >= 3 && cells[1] === "Total:") {
      if (cur) reported[cur] = (reported[cur] ?? 0) + toNumber(cells[2]);
      continue;
    }
    // Bill row
    if (cur && /^\d{2} [A-Z]{3} \d{2}$/.test(cells[0] || "")) {
      const overdueRaw = cells[4] ?? "";
      rows.push({
        customer: cur,
        ref: cells[1] || "",
        billDate: tallyDateToDMY(cells[0]),
        pending: toNumber(cells[2]),
        dueDate: tallyDateToDMY(cells[3] || "") || tallyDateToDMY(cells[0]),
        overdue: /^-?\d+$/.test(overdueRaw) ? parseInt(overdueRaw, 10) : 0,
      });
    }
  }

  // checksum: parsed per-customer sums vs reported totals
  const per: Record<string, number> = {};
  for (const r of rows) per[r.customer] = (per[r.customer] ?? 0) + r.pending;
  const mismatches = Object.entries(reported)
    .filter(([c, t]) => Math.abs((per[c] ?? 0) - t) > 0.02)
    .map(([c, t]) => ({ customer: c, parsed: per[c] ?? 0, reported: t }));

  return {
    rows,
    customerCount: Object.keys(per).length,
    totalPending: rows.reduce((s, r) => s + r.pending, 0),
    mismatches,
  };
}
