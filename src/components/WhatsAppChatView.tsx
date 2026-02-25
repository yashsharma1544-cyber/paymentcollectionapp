import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWatiMessages, type WatiMessage } from "@/lib/wati";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, RefreshCw, ArrowDown } from "lucide-react";

interface WhatsAppChatViewProps {
  phone: string;
  customerName: string;
}

export function WhatsAppChatView({ phone, customerName }: WhatsAppChatViewProps) {
  const { data: messages = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["wati-messages", phone],
    queryFn: () => getWatiMessages(phone),
    enabled: !!phone,
  });

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const ta = new Date(a.time).getTime();
      const tb = new Date(b.time).getTime();
      return ta - tb;
    });
  }, [messages]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!phone) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
        No phone number available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          WhatsApp Chat
        </h2>
        <div className="flex items-center gap-1.5">
          {sortedMessages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={scrollToBottom}>
              <ArrowDown className="h-3 w-3" /> Latest
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : sortedMessages.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
          No WhatsApp messages found for this number
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/20 p-3 max-h-[400px] overflow-y-auto space-y-2">
          {sortedMessages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={`flex ${msg.owner ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  msg.owner
                    ? "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100"
                    : "bg-card border text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text || `[${msg.type}]`}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatMessageTime(msg.time)}
                  </span>
                  {msg.owner && msg.statusString && (
                    <span className="text-[10px] text-muted-foreground">
                      {msg.statusString === "SENT" ? "✓" : msg.statusString === "DELIVERED" ? "✓✓" : msg.statusString === "READ" ? "✓✓" : msg.statusString}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}
    </div>
  );
}

function formatMessageTime(time: string): string {
  try {
    const d = new Date(time);
    if (isNaN(d.getTime())) return time;
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return time;
  }
}
