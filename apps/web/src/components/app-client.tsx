"use client";

import { useEffect, useState } from "react";
import { apiHealth, login } from "@/lib/api";
import { DashboardClient } from "./dashboard-client";
import { LoginClient } from "./login-client";

const sessionKey = "repassify.session";

interface Session {
  email: string;
  fullName: string;
  tenantId: string;
  tenantName: string;
  role: string;
  accessToken: string;
  refreshToken: string;
}

export function AppClient() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(sessionKey);
    if (stored) {
      setSession(JSON.parse(stored) as Session);
    }

    apiHealth()
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  async function handleLogin(email: string, password: string) {
    setIsSubmitting(true);
    setLoginError(null);

    try {
      const auth = await login(email, password);
      const nextSession = {
        email,
        fullName: auth.user.fullName,
        tenantId: auth.tenant.id,
        tenantName: auth.tenant.legalName,
        role: auth.role,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken
      };

      window.localStorage.setItem(sessionKey, JSON.stringify(nextSession));
      setSession(nextSession);
      setApiStatus("online");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Nao foi possivel entrar agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(sessionKey);
    setSession(null);
  }

  if (!session) {
    return (
      <LoginClient
        apiStatus={apiStatus}
        error={loginError}
        isSubmitting={isSubmitting}
        onSubmit={handleLogin}
      />
    );
  }

  return <DashboardClient apiStatus={apiStatus} session={session} onLogout={handleLogout} />;
}
