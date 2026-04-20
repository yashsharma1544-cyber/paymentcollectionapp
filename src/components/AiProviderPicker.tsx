import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai-insights";

interface Props {
  value: AiProvider;
  onChange: (p: AiProvider) => void;
  disabled?: boolean;
  className?: string;
}

export function AiProviderPicker({ value, onChange, disabled, className }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AiProvider)} disabled={disabled}>
      <SelectTrigger className={`h-7 text-xs w-auto gap-1 px-2 ${className || ""}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AI_PROVIDERS.map((p) => (
          <SelectItem key={p.value} value={p.value} className="text-xs">
            <span className="font-medium">{p.label}</span>
            <span className="text-muted-foreground ml-2">{p.hint}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
