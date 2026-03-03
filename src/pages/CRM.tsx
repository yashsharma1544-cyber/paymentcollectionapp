import { useQuery } from "@tanstack/react-query";
import { fetchFollowUps, fetchWhatsAppLog, fetchInvoices, fetchWAReplies, type FollowUp, type WhatsAppLogEntry, type WAReply } from "@/lib/api";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FollowUpList } from "@/components/FollowUpList";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import {
  RefreshCw, Search, CalendarClock, Users, MessageCircle, Clock, Plus, ArrowLeft, CalendarIcon, IndianRupee, CreditCard, BellRing,
} from "lucide-react";
import { LumpsumPaymentDialog } from "@/components/LumpsumPaymentDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { parseDateDMY, getOverdueDays } from "@/lib/date-utils";
import { USERS } from "@/contexts/UserContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CRM = () => {
  const { data: followUps = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["followups"],
    queryFn: fetchFollowUps,
  });
  const { data: whatsAppLog = [], isLoading: waLoading } = useQuery({
    queryKey: ["whatsapp-log"],
    queryFn: fetchWhatsAppLog,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });
  const { data: waReplies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ["wa-replies"],
    queryFn: fetchWAReplies,
  });

  const [search, setSearch] = useState("");
  const [showNewFollowUp, setShowNewFollowUp] = useState(false);
  const [userFilter, setUserFilter] = useState<string>("all");
  const [waDateFilter, setWaDateFilter] = useState<Date | undefined>(undefined);
  const [paymentCustomer, setPaymentCustomer] = useState<string | null>(null);

  // Last WhatsApp per customer
  const lastWhatsApp = useMemo(() => {
    const map = new Map<string, WhatsAppLogEntry>();
    for (const entry of whatsAppLog) {
      map.set(entry.customerName, entry);
    }
    return map;
  }, [whatsAppLog]);

  // Outstanding per customer
  const outstandingByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      map.set(inv.customerName, (map.get(inv.customerName) || 0) + inv.outstandingAmount);
    }
    return map;
  }, [invoices]);

  // Today's follow-ups
  const todayStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

  const { todayFollowUps, upcomingFollowUps, allFollowUps } = useMemo(() => {
    let filtered = search
      ? followUps.filter((f) => f.customerName.toLowerCase().includes(search.toLowerCase()))
      : [...followUps];

    if (userFilter !== "all") {
      filtered = filtered.filter((f) => f.addedBy === userFilter);
    }

    const today: FollowUp[] = [];
    const upcoming: FollowUp[] = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const f of filtered) {
      const nextDate = f.nextFollowUpDate ? parseDateForCRM(f.nextFollowUpDate) : null;
      if (nextDate) {
        nextDate.setHours(0, 0, 0, 0);
        if (nextDate <= now && f.status === "Pending") {
          today.push(f);
          continue;
        }
        if (nextDate > now && f.status === "Pending") {
          upcoming.push(f);
          continue;
        }
      }
    }

    return { todayFollowUps: today, upcomingFollowUps: upcoming, allFollowUps: filtered };
  }, [followUps, search, userFilter]);

  // Per-user KPI breakdown
  const userKPIs = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return USERS.map((name) => {
      const userFollowUps = followUps.filter((f) => f.addedBy === name);
      let todayCount = 0;
      let completedCount = 0;
      let pendingCount = 0;

      for (const f of userFollowUps) {
        if (f.status === "Done") {
          completedCount++;
          continue;
        }
        const nextDate = f.nextFollowUpDate ? parseDateForCRM(f.nextFollowUpDate) : null;
        if (nextDate) {
          nextDate.setHours(0, 0, 0, 0);
          if (nextDate <= now && f.status === "Pending") {
            todayCount++;
          }
        }
        if (f.status === "Pending") pendingCount++;
      }

      return { name, todayCount, completedCount, pendingCount, total: userFollowUps.length };
    });
  }, [followUps]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to="/">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">CRM & Follow-ups</h1>
                <p className="text-xs text-muted-foreground">Manage customer follow-ups</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewFollowUp(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Per-User KPI Cards */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Follow-ups by Person</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {userKPIs.map((u) => (
              <Card
                key={u.name}
                className={`border-0 shadow-sm cursor-pointer transition-all ${userFilter === u.name ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/30"}`}
                onClick={() => setUserFilter(userFilter === u.name ? "all" : u.name)}
              >
                <CardContent className="p-3">
                  <p className="text-sm font-bold mb-2">{u.name.split(" ")[0]}</p>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className="bg-primary/10 rounded-lg p-1.5">
                      <p className="text-lg font-black text-primary">{u.todayCount}</p>
                      <p className="text-[8px] text-muted-foreground uppercase">Today</p>
                    </div>
                    <div className="bg-success/10 rounded-lg p-1.5">
                      <p className="text-lg font-black text-success">{u.completedCount}</p>
                      <p className="text-[8px] text-muted-foreground uppercase">Done</p>
                    </div>
                    <div className="bg-warning/10 rounded-lg p-1.5">
                      <p className="text-lg font-black text-warning">{u.pendingCount}</p>
                      <p className="text-[8px] text-muted-foreground uppercase">Pending</p>
                    </div>
                    <div className="bg-muted rounded-lg p-1.5">
                      <p className="text-lg font-black text-foreground">{u.total}</p>
                      <p className="text-[8px] text-muted-foreground uppercase">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Search + User Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant={userFilter === "all" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setUserFilter("all")}
            >
              All
            </Button>
            {USERS.map((name) => (
              <Button
                key={name}
                variant={userFilter === name ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setUserFilter(name)}
              >
                {name.split(" ")[0]}
              </Button>
            ))}
            {userFilter !== "all" && (
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setUserFilter("all")}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <Tabs defaultValue="today" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="today" className="flex-1 text-xs">
                Today ({todayFollowUps.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex-1 text-xs">
                Upcoming ({upcomingFollowUps.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1 text-xs">
                All ({allFollowUps.length})
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex-1 text-xs">
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="replies" className="flex-1 text-xs">
                Replies
              </TabsTrigger>
              <TabsTrigger value="auto-reminders" className="flex-1 text-xs">
                <BellRing className="h-3 w-3 mr-1" />
                Auto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-3">
              <FollowUpList followUps={todayFollowUps} showCustomerName />
            </TabsContent>

            <TabsContent value="upcoming" className="mt-3">
              <FollowUpList followUps={upcomingFollowUps} showCustomerName />
            </TabsContent>

            <TabsContent value="all" className="mt-3">
              <FollowUpList followUps={[...allFollowUps].reverse()} showCustomerName />
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-3">
              {waLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : whatsAppLog.length === 0 ? (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
                  No WhatsApp messages logged yet
                </div>
              ) : (() => {
                // Filter by date
                const filteredWA = waDateFilter
                  ? whatsAppLog.filter((entry) => {
                      const d = parseWATimestamp(entry.timestamp);
                      if (!d) return false;
                      return d.toDateString() === waDateFilter.toDateString();
                    })
                  : whatsAppLog;

                // Unique customers who received reminders (in filtered list)
                const uniqueCustomers = new Set(filteredWA.map((e) => e.customerName));
                const totalOutstandingReminded = Array.from(uniqueCustomers).reduce(
                  (sum, name) => sum + (outstandingByCustomer.get(name) || 0), 0
                );

                return (
                  <div className="space-y-3">
                    {/* Date filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !waDateFilter && "text-muted-foreground")}>
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {waDateFilter ? format(waDateFilter, "dd MMM yyyy") : "Filter by date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={waDateFilter}
                            onSelect={setWaDateFilter}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      {waDateFilter && (
                        <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setWaDateFilter(undefined)}>
                          Clear
                        </Button>
                      )}
                    </div>

                    {/* Summary card */}
                    <Card className="border-0 shadow-sm bg-destructive/10">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IndianRupee className="h-4 w-4 text-destructive" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Outstanding (Reminded)</p>
                            <p className="text-lg font-black text-destructive">₹{totalOutstandingReminded.toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{uniqueCustomers.size} customer{uniqueCustomers.size !== 1 ? "s" : ""}</p>
                          <p className="text-xs text-muted-foreground">{filteredWA.length} message{filteredWA.length !== 1 ? "s" : ""}</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Entries */}
                    {[...filteredWA].reverse().slice(0, 50).map((entry, i) => {
                      const amt = outstandingByCustomer.get(entry.customerName) || 0;
                      return (
                        <Card key={i} className="border shadow-sm">
                          <CardContent className="p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`/customer/${encodeURIComponent(entry.customerName)}`}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                {entry.customerName}
                              </Link>
                              <p className="text-xs text-muted-foreground">{entry.phone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {amt > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-xs h-7 px-2"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setPaymentCustomer(entry.customerName);
                                  }}
                                >
                                  <CreditCard className="h-3 w-3" />
                                  Pay
                                </Button>
                              )}
                              <div className="flex flex-col items-end gap-0.5">
                                {amt > 0 ? (
                                  <span className="text-sm font-bold text-destructive">₹{amt.toLocaleString("en-IN")}</span>
                                ) : (
                                  <span className="text-xs font-medium text-success">Cleared</span>
                                )}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {entry.timestamp}
                                </div>
                                {entry.sentBy && (
                                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-medium">{entry.sentBy}</span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {filteredWA.length === 0 && (
                      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
                        No messages on this date
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="replies" className="mt-3">
              {repliesLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : waReplies.length === 0 ? (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
                  No incoming replies yet. Set up WATI webhook to receive messages.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...waReplies].reverse().slice(0, 50).map((reply, i) => {
                    // Match phone to customer name via WhatsApp log
                    const normalizedPhone = reply.phone.replace(/^91/, "");
                    const matchedEntry = whatsAppLog.find(
                      (e) => e.phone === normalizedPhone || e.phone === reply.phone
                    );
                    const customerName = matchedEntry?.customerName || reply.contactName || reply.phone;
                    const amt = outstandingByCustomer.get(customerName) || 0;

                    return (
                      <Card key={i} className="border shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/customer/${encodeURIComponent(customerName)}`}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                {customerName}
                              </Link>
                              <p className="text-xs text-muted-foreground">{reply.phone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {amt > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-xs h-7 px-2"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setPaymentCustomer(customerName);
                                  }}
                                >
                                  <CreditCard className="h-3 w-3" />
                                  Pay
                                </Button>
                              )}
                              <div className="flex flex-col items-end gap-0.5">
                                {amt > 0 ? (
                                  <span className="text-sm font-bold text-destructive">₹{amt.toLocaleString("en-IN")}</span>
                                ) : matchedEntry ? (
                                  <span className="text-xs font-medium text-success">Cleared</span>
                                ) : null}
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                    reply.direction === "incoming" 
                                      ? "bg-primary/10 text-primary" 
                                      : "bg-green-100 text-green-700"
                                  }`}>
                                    {reply.direction === "incoming" ? "↓ IN" : "↑ OUT"}
                                  </span>
                                  <Clock className="h-3 w-3" />
                                  {reply.timestamp}
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs mt-1.5 bg-muted/30 rounded p-2">{reply.messageText}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="auto-reminders" className="mt-3">
              {repliesLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : (() => {
                const autoReminders = waReplies.filter(
                  (r) => r.messageType === "auto_reminder" || r.messageType === "auto_escalation" || r.messageType === "auto_final"
                );
                if (autoReminders.length === 0) {
                  return (
                    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
                      No auto-reminders sent yet. The cron runs daily at 9 AM IST.
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    <Card className="border-0 shadow-sm bg-primary/10">
                      <CardContent className="p-3 flex items-center gap-2">
                        <BellRing className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">{autoReminders.length} auto-reminders sent</p>
                          <p className="text-xs text-muted-foreground">
                            {new Set(autoReminders.map((r) => r.contactName)).size} unique customers
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    {[...autoReminders].reverse().slice(0, 100).map((r, i) => {
                      const typeLabel = r.messageType === "auto_reminder" ? "🔔 Due Today"
                        : r.messageType === "auto_escalation" ? "⚠️ Overdue D+1"
                        : "🚨 Final D+3";
                      const typeColor = r.messageType === "auto_reminder" ? "bg-primary/10 text-primary"
                        : r.messageType === "auto_escalation" ? "bg-yellow-100 text-yellow-700"
                        : "bg-destructive/10 text-destructive";
                      return (
                        <Card key={i} className="border shadow-sm">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <Link
                                  to={`/customer/${encodeURIComponent(r.contactName)}`}
                                  className="text-sm font-semibold text-primary hover:underline"
                                >
                                  {r.contactName}
                                </Link>
                                <p className="text-xs text-muted-foreground">{r.phone}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeColor}`}>
                                  {typeLabel}
                                </span>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {r.timestamp}
                                </div>
                              </div>
                            </div>
                            <p className="text-xs mt-1.5 bg-muted/30 rounded p-2">{r.messageText}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        )}

        <FollowUpDialog
          customerName=""
          open={showNewFollowUp}
          onClose={() => setShowNewFollowUp(false)}
          onSuccess={() => refetch()}
          allowCustomerNameEdit
        />

        {paymentCustomer && (
          <LumpsumPaymentDialog
            invoices={invoices.filter((inv) => inv.customerName === paymentCustomer)}
            customerName={paymentCustomer}
            open={!!paymentCustomer}
            onClose={() => setPaymentCustomer(null)}
            onSuccess={() => {
              setPaymentCustomer(null);
              refetch();
            }}
          />
        )}
      </main>
    </div>
  );
};

function parseDateForCRM(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Handle YYYY-MM-DD
  if (dateStr.includes("-") && dateStr.length === 10) {
    const d = new Date(dateStr + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  // Handle DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Parse WA log timestamp like "02/03/2026, 10:30 AM" or "2/3/2026 10:30:00" */
function parseWATimestamp(ts: string): Date | null {
  if (!ts) return null;
  // Try common formats: "DD/MM/YYYY, HH:MM AM" or "DD/MM/YYYY HH:MM:SS"
  const cleaned = ts.replace(",", "").trim();
  const parts = cleaned.split(/[\s]+/);
  if (parts.length >= 1) {
    const datePart = parts[0];
    const segments = datePart.split("/");
    if (segments.length === 3) {
      const d = new Date(Number(segments[2]), Number(segments[1]) - 1, Number(segments[0]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  const fallback = new Date(ts);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export default CRM;
