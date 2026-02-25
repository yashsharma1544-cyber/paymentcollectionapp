import { useQuery } from "@tanstack/react-query";
import { fetchRecordedPayments, type RecordedPayment } from "@/lib/api";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ArrowLeft, RefreshCw, Calendar as CalendarIcon } from "lucide-react";
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold font-['Space_Grotesk'] tracking-tight">
                Recorded Payments
              </h1>
              <p className="text-xs text-muted-foreground">
                View all collected payments
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Bill No or Customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("gap-2 text-sm", !fromDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {fromDate ? format(fromDate, "dd MMM yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate} onSelect={setFromDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("gap-2 text-sm", !toDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {toDate ? format(toDate, "dd MMM yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate} onSelect={setToDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              {(fromDate || toDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
                  Clear dates
                </Button>
              )}

              <span className="text-sm text-muted-foreground ml-auto">
                {filtered.length} record{filtered.length !== 1 ? "s" : ""} · Total: ₹{totalCollected.toLocaleString("en-IN")}
              </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Bill No</TableHead>
                      <TableHead className="font-semibold">Customer</TableHead>
                      <TableHead className="font-semibold text-right">Paid Amount</TableHead>
                      <TableHead className="font-semibold">Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          No recorded payments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((p, i) => (
                        <TableRow key={`${p.billNo}-${i}`} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs">{p.billNo}</TableCell>
                          <TableCell className="font-medium">{p.customerName}</TableCell>
                          <TableCell className="text-right font-semibold text-success">
                            ₹{p.paidAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.timestamp}</TableCell>
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
