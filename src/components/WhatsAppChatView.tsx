import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWatiMessages, sendWatiSessionMessage, type WatiMessage } from "@/lib/wati";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, RefreshCw, ArrowDown, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppChatViewProps {
  phone: string;
  customerName: string;
}

export function WhatsAppChatView({ phone, customerName }: WhatsAppChatViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

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

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !phone) return;
    setSending(true);
    try {
      const result = await sendWatiSessionMessage(phone, text);
      if (result.success) {
        setMessageText("");
        toast({ title: "Message sent" });
        setTimeout(() => { refetch(); scrollToBottom(); }, 1500);
      } else {
        toast({ title: "Failed to send", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
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
                    <span className={`text-[10px] ${msg.statusString === "FAILED" ? "text-red-500" : "text-muted-foreground"}`}>
                      {msg.statusString === "SENT" ? "✓" : msg.statusString === "DELIVERED" ? "✓✓" : msg.statusString === "READ" ? "✓✓" : msg.statusString === "FAILED" ? "✗ Failed" : msg.statusString}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Send message input */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={sending}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !messageText.trim()} className="shrink-0 bg-green-600 hover:bg-green-700 h-9 w-9">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
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
