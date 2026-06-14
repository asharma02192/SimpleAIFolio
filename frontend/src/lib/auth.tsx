"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isReady: boolean;
}

interface SessionSnapshot {
  isAuthenticated: boolean;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SESSION_EVENT = "SimpleAIFolio-admin-session";
const SESSION_TOKEN = "session";

let snapshot: SessionSnapshot = {
  isAuthenticated: false,
  isReady: false,
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
  if (!canUseWindow()) return;
  window.dispatchEvent(new Event(SESSION_EVENT));
  getSessionChannel()?.postMessage({ type: "session-changed" });
}

function setSnapshot(next: SessionSnapshot) {
  snapshot = next;
  emitSessionChange();
}

function subscribeToSessionChanges(callback: () => void) {
  if (!canUseWindow()) {
    return () => {};
  }

  const onWindowEvent = () => callback();
  const channel = getSessionChannel();
  const onChannelMessage = () => callback();

  window.addEventListener(SESSION_EVENT, onWindowEvent);
  channel?.addEventListener("message", onChannelMessage);

  return () => {
    window.removeEventListener(SESSION_EVENT, onWindowEvent);
    channel?.removeEventListener("message", onChannelMessage);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot(): SessionSnapshot {
  return { isAuthenticated: false, isReady: false };
}

export async function refreshAdminSession() {
  if (!canUseWindow()) {
    return false;
  }

  if (pendingSessionRefresh) {
    return pendingSessionRefresh;
  }

  pendingSessionRefresh = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });

      const isAuthenticated = res.ok;
      setSnapshot({
        isAuthenticated,
        isReady: true,
      });

      return isAuthenticated;
    } catch {
      setSnapshot({
        isAuthenticated: false,
        isReady: true,
      });
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
  });

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

    setSnapshot({
      isAuthenticated: true,
      isReady: true,
    });
  }, []);

  const logout = useCallback(async () => {
    await clearAdminSession({ notifyBackend: true });
    router.push("/admin");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        token: session.isAuthenticated ? SESSION_TOKEN : null,
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
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: mergeHeaders(options),
  });

  if (res.status === 401) {
    await clearAdminSession({ notifyBackend: false, redirectToLogin: true });
    throw new Error("Unauthorized");
  }

  return res;
}
