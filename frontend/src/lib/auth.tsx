"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, setAuthToken, clearAuthToken, getAuthToken } from "./api";

export interface User {
  id: number;
  email: string;
  role: "admin" | "engineer" | "operator" | "viewer";
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadUser() {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        if (pathname !== "/login" && pathname !== "/") {
          router.push("/login");
        }
        return;
      }

      try {
        const u = await api.auth.me();
        setUser(u);
      } catch (err) {
        clearAuthToken();
        setUser(null);
        if (pathname !== "/login") {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [pathname, router]);

  const login = async (email: string, pass: string) => {
    const res = await api.auth.login({ email, password: pass });
    setAuthToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const register = async (email: string, pass: string) => {
    const res = await api.auth.register({ email, password: pass });
    setAuthToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    clearAuthToken();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
