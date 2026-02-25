import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import Index from "./pages/Index";
import RecordedPayments from "./pages/RecordedPayments";
import BeatDetail from "./pages/BeatDetail";
import CustomerDetail from "./pages/CustomerDetail";
import DueToday from "./pages/DueToday";
import Install from "./pages/Install";
import DailyReport from "./pages/DailyReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="pb-14 sm:pb-0">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/payments" element={<RecordedPayments />} />
            <Route path="/beat/:beatName" element={<BeatDetail />} />
            <Route path="/customer/:customerName" element={<CustomerDetail />} />
            <Route path="/due-today" element={<DueToday />} />
            <Route path="/daily-report" element={<DailyReport />} />
            <Route path="/install" element={<Install />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <BottomNav />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
