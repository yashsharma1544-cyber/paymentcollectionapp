import { USERS, useUser } from "@/contexts/UserContext";
import { IndianRupee, ArrowRight } from "lucide-react";

const UserSelect = () => {
  const { setCurrentUser } = useUser();

  const initials = (name: string) =>
    name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen surface-hero flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-primary shadow-glow mb-5">
            <IndianRupee className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Payment Collector</h1>
          <p className="text-sm text-muted-foreground mt-2">Select your name to continue</p>
        </div>

        <div className="space-y-2.5">
          {USERS.map((name) => (
            <button
              key={name}
              onClick={() => setCurrentUser(name)}
              className="group w-full flex items-center gap-3 p-3.5 rounded-2xl border bg-card shadow-card hover:shadow-elevated hover:border-primary/40 hover:-translate-y-0.5 transition-all text-left"
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 shadow-soft">
                {initials(name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold leading-tight">{name}</p>
                <p className="text-xs text-muted-foreground">Tap to continue</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-8">
          Your selection is remembered on this device
        </p>
      </div>
    </div>
  );
};

export default UserSelect;
