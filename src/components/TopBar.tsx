import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/lib/api";
import { Search, RefreshCw, Bell, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";

export function TopBar({ onRefresh, isFetching }: { onRefresh?: () => void; isFetching?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    const seen = new Set<string>();
    const out: { name: string; beat: string }[] = [];
    for (const inv of invoices) {
      if (seen.has(inv.customerName)) continue;
      if (inv.customerName.toLowerCase().includes(s) || inv.mobileNo.includes(q) || inv.billNo.toLowerCase().includes(s)) {
        seen.add(inv.customerName);
        out.push({ name: inv.customerName, beat: inv.beat });
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [q, invoices]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <header className="sticky top-0 z-30 h-16 bg-card/95 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 sm:px-6">
      <div className="hidden sm:block min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Today</p>
        <p className="text-xs font-semibold text-foreground -mt-0.5">{today}</p>
      </div>

      <div className="relative flex-1 max-w-lg ml-auto sm:ml-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search customer, bill, or mobile…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9 h-10 rounded-md bg-muted/40 border-transparent focus-visible:bg-card focus-visible:border-input"
        />
        {open && results.length > 0 && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-popover border rounded-md shadow-elevated overflow-hidden z-50">
            {results.map((r) => (
              <button
                key={r.name}
                onMouseDown={(e) => { e.preventDefault(); navigate(`/customer/${encodeURIComponent(r.name)}`); setQ(""); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted text-left transition-colors"
              >
                <span className="text-sm font-medium truncate">{r.name}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{r.beat}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Link to="/install" className="hidden md:block">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md" title="Install app">
            <Download className="h-4 w-4" />
          </Button>
        </Link>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="h-9 rounded-md gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        )}
      </div>
    </header>
  );
}
