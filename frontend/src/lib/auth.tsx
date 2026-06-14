"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  userRole: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isReady: boolean;
}

interface SessionSnapshot {
  isAuthenticated: boolean;
  isReady: boolean;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SESSION_EVENT = "SimpleAIFolio-admin-session";
const SESSION_TOKEN = "session";

let snapshot: SessionSnapshot = {
  isAuthenticated: false,
  isReady: false,
  user: null,
};

let pendingSessionRefresh: Promise<boolean> | null = null;
let sessionChannel: BroadcastChannel | null = null;

function canUseWindow() {
  return typeof window !== "undefined";
}

function getSessionChannel() {
  if (!canUseWindow() || typeof BroadcastChannel === "undefined") {
    return null;
  }

  if (!sessionChannel) {
    sessionChannel = new BroadcastChannel(SESSION_EVENT);
  }

  return sessionChannel;
}

function emitSessionChange() {
  getSessionChannel()?.postMessage(snapshot);
}

function setSnapshot(next: SessionSnapshot) {
  snapshot = next;
  emitSessionChange();
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot(): SessionSnapshot {
  return {
    isAuthenticated: false,
    isReady: false,
    user: null,
  };
}

function subscribeToSessionChanges(callback: () => void) {
  const channel = getSessionChannel();

  if (channel) {
    const handler = () => callback();
    channel.addEventListener("message", handler);
    return () => channel.removeEventListener("message", handler);
  }

  return () => {};
}

async function refreshAdminSession(): Promise<boolean> {
  if (pendingSessionRefresh) return pendingSessionRefresh;

  pendingSessionRefresh = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        setSnapshot({ isAuthenticated: false, isReady: true, user: null });

        if (canUseWindow()) {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_role");
        }

        return false;
      }

      const data = await res.json();

      setSnapshot({
        isAuthenticated: true,
        isReady: true,
        user: data.user,
      });

      return true;
    } catch {
      setSnapshot({ isAuthenticated: false, isReady: true, user: null });
      return false;
    } finally {
      pendingSessionRefresh = null;
    }
  })();

  return pendingSessionRefresh;
}

export async function clearAdminSession(options?: { notifyBackend?: boolean; redirectToLogin?: boolean }) {
  const { notifyBackend = true, redirectToLogin = false } = options || {};

  if (notifyBackend) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort cookie cleanup.
    }
  }

  setSnapshot({
    isAuthenticated: false,
    isReady: true,
    user: null,
  });

  if (canUseWindow()) {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_role");
  }

  if (redirectToLogin && canUseWindow()) {
    window.location.href = "/admin";
  }
}

export async function logoutAdmin() {
  await clearAdminSession({ notifyBackend: true, redirectToLogin: true });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribeToSessionChanges, getSnapshot, getServerSnapshot);
  const router = useRouter();

  useEffect(() => {
    if (!session.isReady) {
      void refreshAdminSession();
    }
  }, [session.isReady]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }

    await refreshAdminSession();
  }, []);

  const logout = useCallback(async () => {
    await clearAdminSession({ notifyBackend: true });
    router.push("/admin");
  }, [router]);

  const userRole = session.user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        token: session.isAuthenticated ? SESSION_TOKEN : null,
        userRole,
        user: session.user,
        login,
        logout,
        isAuthenticated: session.isAuthenticated,
        isReady: session.isReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function mergeHeaders(options?: RequestInit) {
  const merged = new Headers(options?.headers);
  const isFormData = canUseWindow() && options?.body instanceof FormData;

  if (!isFormData && !merged.has("Content-Type")) {
    merged.set("Content-Type", "application/json");
  }

  return merged;
}

export async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: mergeHeaders(options),
    credentials: "include",
  });
}
