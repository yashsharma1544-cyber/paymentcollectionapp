import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";
import { uploadOutstanding, fetchUploadLog, type UploadLogEntry } from "@/lib/api";
import { parseOutstandingCsv, type ParsedOutstanding } from "@/lib/parse-outstanding-csv";

const COMPANIES = ["Sushil Agencies", "Anjali Agencies"] as const;

const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function UploadData() {
  const [company, setCompany] = useState<(typeof COMPANIES)[number] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedOutstanding | null>(null);
  const [asOnDate, setAsOnDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<UploadLogEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    fetchUploadLog().then(setLog).catch(() => {});
  }, []);

  const pickFile = (c: (typeof COMPANIES)[number]) => {
    setCompany(c);
    setParsed(null);
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFileName(f.name);
    try {
      const text = await f.text();
      const result = parseOutstandingCsv(text);
      if (result.rows.length === 0) {
        toast.error("CSV se koi bill nahi mila — file format check karo (Biz Analyst Outstanding CSV chahiye)");
        return;
      }
      setParsed(result);
      // Try to read the as-on date from the filename, e.g. "Outstanding_-_12_JUL_26.csv"
      const m = f.name.match(/(\d{2})[_ ]([A-Z]{3})[_ ](\d{2})/i);
      if (m) {
        const months: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
        const mm = months[m[2].toUpperCase()];
        if (mm) setAsOnDate(`${m[1]}/${mm}/20${m[3]}`);
      }
    } catch (err) {
      toast.error(`Parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const confirm = async () => {
    if (!company || !parsed) return;
    setBusy(true);
    try {
      const res = await uploadOutstanding(company, asOnDate, parsed.rows);
      toast.success(
        `${company}: ${res.inserted} bills upload ho gaye (${inr(res.totalPending)})` +
        (res.newCustomers.length ? ` — ${res.newCustomers.length} naye customers` : ""),
      );
      setParsed(null);
      setCompany(null);
      setFileName("");
      qc.invalidateQueries();
      fetchUploadLog().then(setLog).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Outstanding</h1>
          <p className="text-sm text-muted-foreground">
            Biz Analyst se export kiya hua Outstanding CSV upload karo. Us company ka pura purana data
            <span className="font-semibold"> overwrite </span>ho jayega.
          </p>
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMPANIES.map((c) => (
            <Card
              key={c}
              className={`cursor-pointer transition-all hover:shadow-md ${company === c ? "ring-2 ring-primary" : ""}`}
              onClick={() => pickFile(c)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">{c}</div>
                  <div className="text-xs text-muted-foreground">CSV choose karne ke liye tap karo</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {parsed && company && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Preview — {company}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">{fileName}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-lg font-bold">{parsed.rows.length}</div>
                  <div className="text-xs text-muted-foreground">Bills</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-lg font-bold">{parsed.customerCount}</div>
                  <div className="text-xs text-muted-foreground">Customers</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-lg font-bold">{inr(parsed.totalPending)}</div>
                  <div className="text-xs text-muted-foreground">Total Pending</div>
                </div>
              </div>

              {parsed.mismatches.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Checksum OK — har customer ka total exact match
                </div>
              ) : (
                <div className="text-sm text-amber-600 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    {parsed.mismatches.length} customers ke totals match nahi hue:
                    <ul className="mt-1 list-disc pl-4">
                      {parsed.mismatches.slice(0, 5).map((m) => (
                        <li key={m.customer}>{m.customer}: parsed {inr(m.parsed)} vs report {inr(m.reported)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">As-on date:</span>
                <input
                  className="border rounded-md px-2 py-1 text-sm w-32 bg-background"
                  value={asOnDate}
                  onChange={(e) => setAsOnDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                />
              </div>

              <Button className="w-full" onClick={confirm} disabled={busy}>
                {busy ? "Uploading..." : `Confirm — ${company} ka data overwrite karo`}
              </Button>
            </CardContent>
          </Card>
        )}

        {log.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent Uploads</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {log.slice(0, 8).map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5 last:pb-0">
                  <div>
                    <span className="font-medium">{l.company}</span>
                    <span className="text-muted-foreground"> · as on {l.asOn}</span>
                    {l.newCustomers > 0 && <span className="text-amber-600"> · {l.newCustomers} new</span>}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{l.bills} bills · {inr(l.totalPending)}</div>
                    <div className="text-xs text-muted-foreground">{l.uploadedAt}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
