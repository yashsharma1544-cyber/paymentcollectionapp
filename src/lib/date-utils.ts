export function parseDateDMY(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-\/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function getOverdueDays(dateStr: string): number {
  const d = parseDateDMY(dateStr);
  if (!d) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function formatOverdue(days: number): string {
  if (days === 0) return "Today";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (remainingDays === 0) return `${months}m`;
  return `${months}m ${remainingDays}d`;
}

export function isToday(dateStr: string): boolean {
  const d = parseDateDMY(dateStr);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function isTodayOrBefore(dateStr: string): boolean {
  const d = parseDateDMY(dateStr);
  if (!d) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d <= now;
}

/** Calculate average collection days from bill date to payment date */
export function calcAvgCollectionDays(
  invoices: { billNo: string; billDate: string }[],
  payments: { billNo: string; paymentDate: string }[]
): number | null {
  const billDateMap = new Map<string, Date>();
  for (const inv of invoices) {
    const d = parseDateDMY(inv.billDate);
    if (d) billDateMap.set(inv.billNo, d);
  }

  const daysArr: number[] = [];
  for (const p of payments) {
    const billDate = billDateMap.get(p.billNo);
    const payDate = parseDateDMY(p.paymentDate);
    if (billDate && payDate) {
      billDate.setHours(0, 0, 0, 0);
      payDate.setHours(0, 0, 0, 0);
      const diff = Math.max(0, Math.floor((payDate.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24)));
      daysArr.push(diff);
    }
  }

  if (daysArr.length === 0) return null;
  return Math.round(daysArr.reduce((s, d) => s + d, 0) / daysArr.length);
}
