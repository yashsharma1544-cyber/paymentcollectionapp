import { useQuery } from "@tanstack/react-query";
import { fetchRecordedPayments } from "@/lib/api";
import { fetchInvoices } from "@/lib/api";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, RefreshCw, IndianRupee,
  Users, MapPin, FileText, Calendar as CalendarIcon, UserCircle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { USERS } from "@/contexts/UserContext";

function parseTimestamp(ts: string): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d;
  const match = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

interface CustomerSummary {
  customerName: string;
  beat: string;
  totalCollected: number;
  invoiceCount: number;
}

const DailyReport = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedBeat, setSelectedBeat] = useState<string>("all");

  const { data: payments = [], isLoading: loadingPayments, refetch: refetchPayments, isFetching: fetchingPayments } = useQuery({
    queryKey: ["recorded-payments"],
    queryFn: fetchRecordedPayments,
  });

  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices, isFetching: fetchingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const isLoading = loadingPayments || loadingInvoices;
  const isFetching = fetchingPayments || fetchingInvoices;

  const refetch = () => {
    refetchPayments();
    refetchInvoices();
  };

  // Build customerName → beat from invoices
  const customerBeatMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of invoices) {
      if (!map.has(inv.customerName)) map.set(inv.customerName, inv.beat);
    }
    return map;
  }, [invoices]);

  // Filter payments by selected date using timestamp (column D)
  const dayPayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.paidAmount <= 0) return false;
      const ts = parseTimestamp(p.timestamp);
      if (!ts) return false;
      return isSameDay(ts, selectedDate);
    });
  }, [payments, selectedDate]);

  const { customers, totalCollected, totalBills } = useMemo(() => {
    const map = new Map<string, { totalCollected: number; bills: Set<string> }>();
    for (const p of dayPayments) {
      if (!map.has(p.customerName)) {
        map.set(p.customerName, { totalCollected: 0, bills: new Set() });
      }
      const entry = map.get(p.customerName)!;
      entry.totalCollected += p.paidAmount;
      entry.bills.add(p.billNo);
    }

    const customers: CustomerSummary[] = Array.from(map.entries())
      .map(([name, d]) => ({
        customerName: name,
        beat: customerBeatMap.get(name) || "Unknown",
        totalCollected: d.totalCollected,
        invoiceCount: d.bills.size,
      }))
      .sort((a, b) => a.customerName.localeCompare(b.customerName));

    const totalCollected = customers.reduce((s, c) => s + c.totalCollected, 0);
    const totalBills = customers.reduce((s, c) => s + c.invoiceCount, 0);

    return { customers, totalCollected, totalBills };
  }, [dayPayments, customerBeatMap]);

  // Per-user breakdown
  const userBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; customers: Set<string>; bills: Set<string> }>();
    for (const p of dayPayments) {
      const user = p.collectedBy || "Unknown";
      if (!map.has(user)) map.set(user, { amount: 0, customers: new Set(), bills: new Set() });
      const entry = map.get(user)!;
      entry.amount += p.paidAmount;
      entry.customers.add(p.customerName);
      entry.bills.add(p.billNo);
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, amount: d.amount, customers: d.customers.size, bills: d.bills.size }))
      .sort((a, b) => b.amount - a.amount);
  }, [dayPayments]);

  // All beats available for the selected date
  const allBeats = useMemo(() => {
    const beats = new Set(customers.map((c) => c.beat));
    return Array.from(beats).sort();
  }, [customers]);

  // Filtered customers by beat
  const filteredCustomers = useMemo(() => {
    if (selectedBeat === "all") return customers;
    return customers.filter((c) => c.beat === selectedBeat);
  }, [customers, selectedBeat]);

  const filteredTotal = filteredCustomers.reduce((s, c) => s + c.totalCollected, 0);
  const filteredBills = filteredCustomers.reduce((s, c) => s + c.invoiceCount, 0);

  const uniqueBeats = useMemo(() => new Set(customers.map((c) => c.beat)).size, [customers]);

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
              <h1 className="text-lg font-bold tracking-tight truncate">Daily Report</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Customers visited & amounts collected</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="shrink-0 sm:hidden" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching} className="gap-2 hidden sm:inline-flex">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
            {/* Date Picker */}
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(selectedDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">
                {isSameDay(selectedDate, new Date()) ? "Today" : format(selectedDate, "EEEE")}
              </span>
              <Select value={selectedBeat} onValueChange={setSelectedBeat}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                  <SelectValue placeholder="All Beats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Beats</SelectItem>
                  {allBeats.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Card className="border-0 shadow-sm bg-success/10">
                <CardContent className="p-2 sm:p-3 text-center">
                  <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Collected</p>
                  <p className="text-xs sm:text-lg font-black text-success leading-tight truncate">
                    ₹{filteredTotal.toLocaleString("en-IN")}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-primary/10">
                <CardContent className="p-2 sm:p-3 text-center">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Customers</p>
                  <p className="text-xs sm:text-lg font-black text-primary leading-tight">{filteredCustomers.length}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-2 sm:p-3 text-center">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Beats</p>
                  <p className="text-xs sm:text-lg font-black leading-tight">{uniqueBeats}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-2 sm:p-3 text-center">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground mx-auto mb-0.5" />
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider">Bills</p>
                  <p className="text-xs sm:text-lg font-black leading-tight">{totalBills}</p>
                </CardContent>
              </Card>
            </div>

            {/* Per-User Breakdown */}
            {userBreakdown.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" />
                  Collection by Person
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {userBreakdown.map((u) => (
                    <Card key={u.name} className="border shadow-sm">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground">{u.customers} customer{u.customers !== 1 ? "s" : ""} · {u.bills} bill{u.bills !== 1 ? "s" : ""}</p>
                        </div>
                        <p className="text-sm font-bold text-success">₹{u.amount.toLocaleString("en-IN")}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Table */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Customer</TableHead>
                      <TableHead className="font-semibold text-xs whitespace-nowrap">Beat</TableHead>
                      <TableHead className="font-semibold text-xs text-center whitespace-nowrap">Bills</TableHead>
                      <TableHead className="font-semibold text-xs text-right whitespace-nowrap">Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          No collections for {format(selectedDate, "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {filteredCustomers.map((c, i) => (
                          <TableRow key={`${c.customerName}-${i}`} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium text-xs">
                              <Link to={`/customer/${encodeURIComponent(c.customerName)}`} className="hover:underline text-primary break-words">
                                {c.customerName}
                              </Link>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {c.beat}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-center">{c.invoiceCount}</TableCell>
                            <TableCell className="text-right font-semibold text-success text-xs whitespace-nowrap">
                              ₹{c.totalCollected.toLocaleString("en-IN")}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell className="text-xs">Total</TableCell>
                          <TableCell />
                          <TableCell className="text-xs text-center">{filteredBills}</TableCell>
                          <TableCell className="text-right text-success text-xs">
                            ₹{filteredTotal.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      </>
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

export default DailyReport;
