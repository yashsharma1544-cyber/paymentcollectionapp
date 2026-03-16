import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, FileDown } from "lucide-react";
import type { Invoice } from "@/lib/invoice";
import { exportToPDF, exportToExcel, exportToCSV } from "@/lib/export";
import type { RecordedPayment } from "@/lib/api";

interface ExportMenuProps {
  invoices: Invoice[];
  title: string;
  payments?: RecordedPayment[];
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "icon" | "default";
}

export function ExportMenu({ invoices, title, payments = [], variant = "outline", size = "sm" }: ExportMenuProps) {
  const pendingInvoices = invoices.filter((i) => i.outstandingAmount > 0);

  if (pendingInvoices.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          {size !== "icon" && "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToPDF(invoices, title, payments)} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-destructive" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(invoices, title, payments)} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-success" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(invoices, title, payments)} className="gap-2 cursor-pointer">
          <FileDown className="h-4 w-4 text-primary" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
