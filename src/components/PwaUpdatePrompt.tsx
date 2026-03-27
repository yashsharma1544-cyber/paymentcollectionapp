import { usePwaUpdate } from "@/hooks/use-pwa-update";
import { RefreshCw } from "lucide-react";
import { APP_VERSION, BUILD_DATE } from "@/lib/version";

export function PwaUpdatePrompt() {
  const { needsUpdate, applyUpdate } = usePwaUpdate();

  return (
    <>
      {/* Version badge — always visible, bottom-right above BottomNav on mobile */}
      <div className="fixed bottom-16 right-3 sm:bottom-3 sm:right-3 z-40">
        <span className="text-[10px] text-muted-foreground/60 bg-card/80 backdrop-blur px-1.5 py-0.5 rounded-md border border-border/40 font-mono leading-tight text-right">
          v{APP_VERSION}
          <br />
          {BUILD_DATE}
        </span>
      </div>

      {/* Update banner */}
      {needsUpdate && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top duration-300">
          <span className="text-sm font-medium">A new version is available!</span>
          <button
            onClick={applyUpdate}
            className="flex items-center gap-1.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 active:scale-[0.97] text-primary-foreground text-sm font-semibold px-3 py-1.5 rounded-md transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Update
          </button>
        </div>
      )}
    </>
  );
}
