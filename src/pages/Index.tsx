import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/lib/api";
import { BeatChart } from "@/components/BeatChart";
import { InvoiceTable } from "@/components/InvoiceTable";
import { RefreshCw, Receipt, History, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";

const Index = () => {
  const {
    data: invoices = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: fetchInvoices,
  });

  const [selectedBeat, setSelectedBeat] = useState<string | null>(null);

  const filteredInvoices = selectedBeat
    ? invoices.filter((inv) => inv.beat === selectedBeat)
    : invoices;

  const grandTotal = useMemo(
    () => invoices.reduce((s, i) => s + i.outstandingAmount, 0),
    [invoices]
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Payment Collector
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage invoices & collect payments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/payments">
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                Payments Log
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {error ? (
          <div className="text-center py-20">
            <p className="text-destructive font-medium mb-2">Failed to load invoices</p>
            <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-20 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Grand Total Bar */}
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-5 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Total Outstanding
              </p>
              <div className="flex items-center justify-center gap-2">
                <IndianRupee className="h-7 w-7 text-destructive" />
                <span className="text-3xl font-black text-destructive tracking-tight">
                  {grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {invoices.length} invoices
              </p>
            </div>

            <BeatChart
              invoices={invoices}
              selectedBeat={selectedBeat}
              onSelectBeat={setSelectedBeat}
            />
            {selectedBeat && (
              <InvoiceTable invoices={filteredInvoices} onPaymentSuccess={() => refetch()} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
