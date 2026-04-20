import { useEffect, useRef, useState } from "react";
import { Calculator as CalcIcon, Delete } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  onApply: (value: number) => void;
}

// Safe arithmetic evaluator: supports + - * / ( ) . and digits only
function evaluate(expr: string): number | null {
  const cleaned = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  if (!cleaned) return null;
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${cleaned});`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export function MiniCalculator({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const result = evaluate(expr);

  useEffect(() => {
    if (open) {
      // Focus input shortly after popover mounts
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setExpr("");
    }
  }, [open]);

  const append = (s: string) => setExpr((e) => e + s);
  const clear = () => setExpr("");
  const back = () => setExpr((e) => e.slice(0, -1));

  const apply = () => {
    if (result === null) return;
    onApply(result);
    setOpen(false);
    setExpr("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const keys = [
    "7", "8", "9", "/",
    "4", "5", "6", "*",
    "1", "2", "3", "-",
    "0", ".", "=", "+",
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Calculator">
          <CalcIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-xs p-3"
        align="end"
        sideOffset={8}
        collisionPadding={8}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="space-y-2">
          <Input
            ref={inputRef}
            value={expr}
            onChange={(e) => setExpr(e.target.value.replace(/×/g, "*").replace(/÷/g, "/"))}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 5000+2000+500"
            inputMode="decimal"
            className="text-right font-mono"
          />
          <div className="rounded-md border bg-muted/30 px-3 py-1.5 text-right">
            <div className="text-lg font-semibold tabular-nums">
              {result !== null ? `₹${result.toLocaleString("en-IN")}` : "—"}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={clear}>C</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => append("(")}>(</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => append(")")}>)</Button>
            <Button type="button" variant="secondary" size="sm" onClick={back}><Delete className="h-3.5 w-3.5" /></Button>
            {keys.map((k) =>
              k === "=" ? (
                <Button key={k} type="button" size="sm" onClick={apply} disabled={result === null}>=</Button>
              ) : (
                <Button
                  key={k}
                  type="button"
                  variant={["+", "-", "*", "/"].includes(k) ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => append(k)}
                >
                  {k === "*" ? "×" : k === "/" ? "÷" : k}
                </Button>
              )
            )}
          </div>
          <Button type="button" className="w-full" size="sm" onClick={apply} disabled={result === null}>
            Use ₹{result !== null ? result.toLocaleString("en-IN") : "0"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
