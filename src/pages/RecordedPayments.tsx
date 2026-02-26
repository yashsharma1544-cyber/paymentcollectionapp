import { useQuery } from "@tanstack/react-query";
import { fetchRecordedPayments, type RecordedPayment } from "@/lib/api";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ArrowLeft, RefreshCw, Calendar as CalendarIcon, IndianRupee } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

function parseDate(timestamp: string): Date | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? null : d;
}

const RecordedPayments = () => {
  const { data: payments = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["recorded-payments"],
    queryFn: fetchRecordedPayments,
  });

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        !search ||
        p.billNo.toLowerCase().includes(search.toLowerCase()) ||
        p.customerName.toLowerCase().includes(search.toLowerCase());

      let matchesDate = true;
      if (fromDate || toDate) {
        const d = parseDate(p.timestamp);
        if (!d) {
          matchesDate = false;
        } else {
          if (fromDate && d < fromDate) matchesDate = false;
          if (toDate) {
            const endOfDay = new Date(toDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (d > endOfDay) matchesDate = false;
          }
        }
      }

      return matchesSearch && matchesDate;
    });
  }, [payments, search, fromDate, toDate]);

  const totalCollected = filtered.reduce((s, p) => s + p.paidAmount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <IndianRupee className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">Recorded Payments</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">View all collected payments</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="shrink-0 sm:hidden" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 hidden sm:inline-flex">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {error ? (
          <div className="text-center py-20">
            <p className="text-destructive font-medium mb-2">Failed to load payments</p>
            <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
             {/* Filters */}
            <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Bill No or Customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !fromDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {fromDate ? format(fromDate, "dd MMM yyyy") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromDate} onSelect={setFromDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !toDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {toDate ? format(toDate, "dd MMM yyyy") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={toDate} onSelect={setToDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                {(fromDate || toDate) && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
                    Clear
                  </Button>
                )}

                <span className="text-xs text-muted-foreground ml-auto">
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""} · ₹{totalCollected.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Bill No</TableHead>
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Customer</TableHead>
                      <TableHead className="font-semibold text-xs text-right whitespace-nowrap">Paid Amount</TableHead>
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Payment Date</TableHead>
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Recorded At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No recorded payments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((p, i) => (
                        <TableRow key={`${p.billNo}-${i}`} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs whitespace-nowrap">{p.billNo}</TableCell>
                          <TableCell className="font-medium text-xs max-w-[120px] sm:max-w-none truncate">{p.customerName}</TableCell>
                          <TableCell className="text-right font-semibold text-success text-xs whitespace-nowrap">
                            ₹{p.paidAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{p.paymentDate || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{p.timestamp}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default RecordedPayments;
