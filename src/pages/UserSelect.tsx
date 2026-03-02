import { USERS, useUser, type UserName } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, User } from "lucide-react";

const UserSelect = () => {
  const { setCurrentUser } = useUser();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <div className="p-3 rounded-xl bg-primary/10 inline-block mb-3">
          <IndianRupee className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Collector</h1>
        <p className="text-sm text-muted-foreground mt-1">Select your name to continue</p>
      </div>
      <div className="grid gap-3 w-full max-w-sm">
        {USERS.map((name) => (
          <Card
            key={name}
            className="cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setCurrentUser(name)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <span className="text-base font-semibold">{name}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default UserSelect;
