import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export const USERS = ["Yash Sharma", "Radhe Suram", "Sahil Tiwari"] as const;
export type UserName = (typeof USERS)[number];

interface UserContextType {
  currentUser: UserName | null;
  setCurrentUser: (name: UserName) => void;
  clearUser: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = "payment-collector-user";

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<UserName | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && USERS.includes(stored as UserName)) return stored as UserName;
    return null;
  });

  const setCurrentUser = (name: UserName) => {
    localStorage.setItem(STORAGE_KEY, name);
    setCurrentUserState(name);
  };

  const clearUser = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUserState(null);
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
