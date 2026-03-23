import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

const QUERY_KEY = "focus-customers";

export function useFocusCustomers() {
  const { currentUser } = useUser();
  const queryClient = useQueryClient();

  const { data: focusCustomers = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY, currentUser],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from("focus_customers")
        .select("customer_name")
        .eq("user_name", currentUser);
      if (error) throw error;
      return (data || []).map((r) => r.customer_name);
    },
    enabled: !!currentUser,
  });

  const focusSet = new Set(focusCustomers);

  const toggleFocus = useMutation({
    mutationFn: async (customerName: string) => {
      if (!currentUser) throw new Error("No user");
      const isFocused = focusSet.has(customerName);
      if (isFocused) {
        const { error } = await supabase
          .from("focus_customers")
          .delete()
          .eq("user_name", currentUser)
          .eq("customer_name", customerName);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("focus_customers")
          .insert({ user_name: currentUser, customer_name: customerName });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, currentUser] });
    },
  });

  return {
    focusCustomers,
    focusSet,
    isLoading,
    isFocused: (name: string) => focusSet.has(name),
    toggleFocus: (name: string) => toggleFocus.mutate(name),
    isToggling: toggleFocus.isPending,
  };
}
