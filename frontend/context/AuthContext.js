"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("trustshare_access_token")
        : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/api/auth/me");
      setUser(res.data);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const res = await api.post("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // If MFA is enabled on this account, the backend returns a short-lived
    // mfa_token instead of real tokens. The caller (login page) must then
    // collect a TOTP code and call verifyMfa() below.
    if (res.data.mfa_required) {
      return { mfaRequired: true, mfaToken: res.data.mfa_token };
    }

    localStorage.setItem("trustshare_access_token", res.data.access_token);
    localStorage.setItem("trustshare_refresh_token", res.data.refresh_token);
    await fetchMe();
    router.push("/dashboard");
    return { mfaRequired: false };
  };

  const verifyMfa = async (mfaToken, code) => {
    const res = await api.post("/api/auth/mfa/verify-login", {
      mfa_token: mfaToken,
      code,
    });
    localStorage.setItem("trustshare_access_token", res.data.access_token);
    localStorage.setItem("trustshare_refresh_token", res.data.refresh_token);
    await fetchMe();
    router.push("/dashboard");
  };

  const register = async (fullName, email, password) => {
    await api.post("/api/auth/register", {
      full_name: fullName,
      email,
      password,
    });
    // Auto-login after successful registration
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem("trustshare_access_token");
    localStorage.removeItem("trustshare_refresh_token");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfa, register, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
