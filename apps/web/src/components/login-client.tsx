"use client";

import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { apiBaseUrl } from "@/lib/api";

interface LoginClientProps {
  apiStatus: "checking" | "online" | "offline";
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginClient({ apiStatus, error, isSubmitting, onSubmit }: LoginClientProps) {
  const [email, setEmail] = useState("admin@repassify.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(email, password);
  }

  return (
    <main className="login-shell">
      <section className="login-visual">
        <img src="/imgs/logo-principal.png" alt="Repassify" />
        <div className="login-copy">
          <span>Financial reconciliation cockpit</span>
          <h1>Concilie repasses, taxas e divergencias em um unico painel.</h1>
          <p>Ambiente conectado a API, banco de dados versionado e login seguro para administradores.</p>
        </div>
      </section>

      <section className="login-panel" aria-label="Entrar no Repassify">
        <div className="login-card">
          <div className="login-card-head">
            <img src="/imgs/icon-light.png" alt="" />
            <div>
              <strong>Entrar no Repassify</strong>
              <span>Use seu usuario administrador</span>
            </div>
          </div>

          <div className={`api-status ${apiStatus}`}>
            <span />
            API {apiStatus === "checking" ? "verificando" : apiStatus === "online" ? "online" : "offline"}
            <small>{apiBaseUrl}</small>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              <span>E-mail</span>
              <div>
                <Mail size={18} />
                <input
                  autoComplete="email"
                  inputMode="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@repassify.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </label>

            <label>
              <span>Senha</span>
              <div>
                <LockKeyhole size={18} />
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error ? <p className="login-error">{error}</p> : null}

            <button className="login-submit" disabled={isSubmitting || apiStatus === "offline"} type="submit">
              {isSubmitting ? <Loader2 className="spin" size={18} /> : null}
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
