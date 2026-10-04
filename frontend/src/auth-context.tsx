import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { api, AuthResponse, setAuthToken, setUnauthorizedHandler, User } from "@/src/api";
import { getToken, setToken } from "@/src/auth-storage";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  loading: boolean;
  user: User | null;
  googleBusy: boolean;
  signInWithGoogle: () => Promise<void>;
  applyAuth: (r: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function stripSessionIdFromWebUrl() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const clean = (s: string) => s.replace(/([?#&])session_id=[^&#]*&?/, "$1").replace(/[?#&]$/, "");
  const search = clean(window.location.search);
  const hash = clean(window.location.hash);
  window.history.replaceState(window.history.state, "", window.location.pathname + search + hash);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const usedSessionIds = useRef<Set<string>>(new Set());
  const qc = useQueryClient();

  const applyAuth = useCallback(async (r: AuthResponse) => {
    await setToken(r.session_token);
    setAuthToken(r.session_token);
    qc.clear();
    setUser(r.user);
  }, [qc]);

  const clearAuth = useCallback(async () => {
    await setToken(null);
    setAuthToken(null);
    qc.clear();
    setUser(null);
  }, [qc]);

  const exchange = useCallback(async (sessionId: string) => {
    if (usedSessionIds.current.has(sessionId)) return;
    usedSessionIds.current.add(sessionId);
    try {
      const r = await api.exchangeSession(sessionId);
      await applyAuth(r);
      stripSessionIdFromWebUrl();
    } catch (e) {
      console.log("session exchange failed", e);
    }
  }, [applyAuth]);

  // Boot: process session_id from URL first, else restore stored token
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let sid: string | null = null;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          sid = extractSessionId(window.location.hash) || extractSessionId(window.location.search);
        } else {
          sid = extractSessionId(await Linking.getInitialURL());
        }
        if (sid) {
          await exchange(sid);
          return;
        }
        const token = await getToken();
        if (!token) return;
        setAuthToken(token);
        try {
          const me = await api.me();
          if (!cancelled) setUser(me);
        } catch {
          await clearAuth();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchange(sid).finally(() => setLoading(false));
    });
    setUnauthorizedHandler(() => {
      clearAuth();
    });
    return () => {
      cancelled = true;
      sub.remove();
      setUnauthorizedHandler(null);
    };
  }, [exchange, clearAuth]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    setGoogleBusy(true);
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      captured = captured || extractSessionId(url);
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let sid = result.type === "success" ? extractSessionId(result.url) : null;
      sid = sid || captured || extractSessionId(await Linking.getInitialURL());
      if (sid) await exchange(sid);
    } finally {
      sub.remove();
      setGoogleBusy(false);
    }
  }, [exchange]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ loading, user, googleBusy, signInWithGoogle, applyAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
