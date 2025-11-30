import React, { createContext, useContext, useState } from "react";
import { User } from "@/types/pos";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "quickpos:user";

const getStoredUser = (): User | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch (error) {
    console.warn("Failed to parse stored user", error);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

const persistUser = (value: User | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (value) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const login = async (email: string, password: string) => {
    const loggedInUser = await api.login({
      email,
      password,
    });
    persistUser(loggedInUser as User);
    setUser(loggedInUser as User);
    return loggedInUser as User;
  };

  const logout = () => {
    setUser(null);
    persistUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
