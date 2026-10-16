"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "./api/client";

// Non-httpOnly routing hint readable by Next middleware on THIS frontend host.
// The real session cookie (access_token) is set by the API on the backend host
// (malique-backend.vercel.app); it is httpOnly and, per the Public Suffix List,
// cross-site to this app, so middleware here can never read it. We mirror auth
// state purely for redirects. The backend still enforces auth on every request.
function setAuthMarker() {
  if (typeof document === "undefined") return;
  document.cookie = "auth_state=1; path=/; max-age=2415600; samesite=lax";
}
function clearAuthMarker() {
  if (typeof document === "undefined") return;
  document.cookie = "auth_state=; path=/; max-age=0; samesite=lax";
}

export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId?: string;
  branchName?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

// The /auth/staff/profile endpoint returns fullName + avatarUrl; the shell
// consumes firstName/lastName. Normalise once at the boundary.
function normaliseProfile(raw: any): StaffUser {
  const fullName: string = raw?.fullName ?? "";
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? raw?.firstName ?? "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : raw?.lastName ?? "";
  return {
    ...raw,
    firstName: raw?.firstName ?? first,
    lastName: raw?.lastName ?? last,
    fullName,
    isActive: raw?.status ? raw.status === "active" : raw?.isActive ?? true,
  } as StaffUser;
}

interface AuthContextValue {
  user: StaffUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await api.get<StaffUser>("/auth/staff/profile");
      setUser(normaliseProfile(profile));
      setAuthMarker();
    } catch {
      setUser(null);
      clearAuthMarker();
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const profile = await api.get<StaffUser>("/auth/staff/profile");
        setUser(normaliseProfile(profile));
        setAuthMarker();
      } catch {
        setUser(null);
        clearAuthMarker();
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post("/auth/staff/login", { email, password });
      const profile = await api.get<StaffUser>("/auth/staff/profile");
      setUser(normaliseProfile(profile));
      setAuthMarker();
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/staff/logout", {});
    } finally {
      setUser(null);
      clearAuthMarker();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
