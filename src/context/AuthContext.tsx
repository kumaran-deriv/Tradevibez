"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  generatePKCE,
  buildAuthUrl,
  storePKCE,
  retrievePKCE,
  clearPKCE,
} from "@/lib/auth";
import type { DerivAccount } from "@/types/deriv";

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  accounts: DerivAccount[];
  activeAccount: DerivAccount | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => void;
  setActiveAccount: (account: DerivAccount) => void;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  accessToken: null,
  accounts: [],
  activeAccount: null,
  loading: false,
  error: null,
  login: async () => {},
  logout: () => {},
  setActiveAccount: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    accounts: [],
    activeAccount: null,
    loading: false,
    error: null,
  });

  // Handle OAuth callback — check URL for code + state on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const authError = params.get("auth_error");

    if (authError) {
      setState((s) => ({ ...s, error: decodeURIComponent(authError) }));
      window.history.replaceState({}, "", "/");
      return;
    }

    if (code && returnedState) {
      handleCallback(code, returnedState);
      window.history.replaceState({}, "", "/");
    }

    // Check for existing token in sessionStorage
    const savedToken = sessionStorage.getItem("deriv_access_token");
    if (savedToken) {
      setState((s) => ({ ...s, accessToken: savedToken, isAuthenticated: true, loading: true }));
      fetchAccounts(savedToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback(code: string, returnedState: string) {
    const { codeVerifier, state: savedState } = retrievePKCE();

    if (!codeVerifier || !savedState || savedState !== returnedState) {
      setState((s) => ({ ...s, error: "Invalid state — possible CSRF attack" }));
      clearPKCE();
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const redirectUri = `${window.location.origin}/api/auth/callback`;

      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Token exchange failed");
      }

      clearPKCE();
      sessionStorage.setItem("deriv_access_token", data.access_token);

      setState((s) => ({
        ...s,
        accessToken: data.access_token,
        isAuthenticated: true,
      }));

      await fetchAccounts(data.access_token);
    } catch (err) {
      clearPKCE();
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Authentication failed",
      }));
    }
  }

  async function fetchAccounts(token: string) {
    try {
      const res = await fetch("/api/deriv/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Failed to fetch accounts");
      }

      const accounts = data.data as DerivAccount[];
      // Default to first demo account
      const demoAccount = accounts.find((a) => a.account_type === "demo") || accounts[0] || null;

      setState((s) => ({
        ...s,
        accounts,
        activeAccount: demoAccount,
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch accounts",
      }));
    }
  }

  const login = useCallback(async () => {
    try {
      const { codeVerifier, codeChallenge, state: pkceState } = await generatePKCE();
      const redirectUri = `${window.location.origin}/api/auth/callback`;

      storePKCE(codeVerifier, pkceState);

      const authUrl = buildAuthUrl(codeChallenge, pkceState, redirectUri);
      window.location.href = authUrl;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to start login",
      }));
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("deriv_access_token");
    clearPKCE();
    setState({
      isAuthenticated: false,
      accessToken: null,
      accounts: [],
      activeAccount: null,
      loading: false,
      error: null,
    });
  }, []);

  const setActiveAccount = useCallback((account: DerivAccount) => {
    setState((s) => ({ ...s, activeAccount: account }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setActiveAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
