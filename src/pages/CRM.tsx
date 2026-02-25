import { useQuery } from "@tanstack/react-query";
import { fetchFollowUps, fetchWhatsAppLog, fetchInvoices, type FollowUp, type WhatsAppLogEntry } from "@/lib/api";
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
import { parseDateDMY } from "@/lib/date-utils";

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

  const [search, setSearch] = useState("");
  const [showNewFollowUp, setShowNewFollowUp] = useState(false);

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
    const filtered = search
      ? followUps.filter((f) => f.customerName.toLowerCase().includes(search.toLowerCase()))
      : followUps;

    const today: FollowUp[] = [];
    const upcoming: FollowUp[] = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const f of filtered) {
      // Check if nextFollowUpDate is today or overdue
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
  }, [followUps, search]);

  const overdueCustomers = useMemo(() => {
    return invoices.filter((i) => i.outstandingAmount > 0 && i.daysOverdue > 0);
  }, [invoices]);

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
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-0 shadow-sm bg-primary/10">
            <CardContent className="p-2 sm:p-4 text-center">
              <CalendarClock className="h-4 w-4 text-primary mx-auto mb-0.5" />
              <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase">Today's Follow-ups</p>
              <p className="text-lg font-black text-primary">{todayFollowUps.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-warning/10">
            <CardContent className="p-2 sm:p-4 text-center">
              <Users className="h-4 w-4 text-warning mx-auto mb-0.5" />
              <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase">Upcoming</p>
              <p className="text-lg font-black text-warning">{upcomingFollowUps.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-success/10">
            <CardContent className="p-2 sm:p-4 text-center">
              <MessageCircle className="h-4 w-4 text-success mx-auto mb-0.5" />
              <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase">Total Follow-ups</p>
              <p className="text-lg font-black text-success">{allFollowUps.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {entry.timestamp}
                        </div>
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
