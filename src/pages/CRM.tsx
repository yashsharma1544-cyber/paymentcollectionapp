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
  RefreshCw, Search, CalendarClock, Users, MessageCircle, Clock, Plus, ArrowLeft,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { parseDateDMY, getOverdueDays } from "@/lib/date-utils";
import { USERS } from "@/contexts/UserContext";

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

  // Last WhatsApp per customer
  const lastWhatsApp = useMemo(() => {
    const map = new Map<string, WhatsAppLogEntry>();
    for (const entry of whatsAppLog) {
      const existing = map.get(entry.customerName);
      if (!existing) {
        map.set(entry.customerName, entry);
      }
      // since entries are appended, last one wins
      map.set(entry.customerName, entry);
    }
    return map;
  }, [whatsAppLog]);

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
              ) : (
                 <div className="space-y-2">
                  {[...whatsAppLog].reverse().slice(0, 50).map((entry, i) => (
                    <Card key={i} className="border shadow-sm">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <Link
                            to={`/customer/${encodeURIComponent(entry.customerName)}`}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            {entry.customerName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{entry.phone}</p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {entry.timestamp}
                          </div>
                          {entry.sentBy && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-medium">{entry.sentBy}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
                  {[...waReplies].reverse().slice(0, 50).map((reply, i) => (
                    <Card key={i} className="border shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{reply.contactName || reply.phone}</p>
                            <p className="text-xs text-muted-foreground">{reply.phone}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
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
                        <p className="text-xs mt-1.5 bg-muted/30 rounded p-2">{reply.messageText}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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

export default CRM;
