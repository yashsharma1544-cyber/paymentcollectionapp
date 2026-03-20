import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { UserProvider, useUser } from "@/contexts/UserContext";
import UserSelect from "./pages/UserSelect";
import Index from "./pages/Index";
import RecordedPayments from "./pages/RecordedPayments";
import BeatDetail from "./pages/BeatDetail";
import CustomerDetail from "./pages/CustomerDetail";
import DueToday from "./pages/DueToday";
import Install from "./pages/Install";
import DailyReport from "./pages/DailyReport";
import CRM from "./pages/CRM";
import MonthlyReport from "./pages/MonthlyReport";
import BeatRoutePlanner from "./pages/BeatRoutePlanner";
import PaymentPredictions from "./pages/PaymentPredictions";
import Defaulters from "./pages/Defaulters";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { currentUser } = useUser();

  if (!currentUser) return <UserSelect />;

  return (
    <BrowserRouter>
      <div className="pb-14 sm:pb-0">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/payments" element={<RecordedPayments />} />
          <Route path="/beat/:beatName" element={<BeatDetail />} />
          <Route path="/customer/:customerName" element={<CustomerDetail />} />
          <Route path="/due-today" element={<DueToday />} />
          <Route path="/daily-report" element={<DailyReport />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/monthly-report" element={<MonthlyReport />} />
          <Route path="/route-planner" element={<BeatRoutePlanner />} />
          <Route path="/predictions" element={<PaymentPredictions />} />
          <Route path="/defaulters" element={<Defaulters />} />
          <Route path="/install" element={<Install />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <BottomNav />
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
