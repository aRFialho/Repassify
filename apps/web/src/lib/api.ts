const fallbackApiBaseUrl =
  process.env.NODE_ENV === "production" ? "https://repassify-api.onrender.com" : "http://localhost:3333";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? fallbackApiBaseUrl;

export interface LoginResponse {
  mfaRequired: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ApiEnvelope<T> {
  data: T;
}

export async function apiHealth(): Promise<{ ok: boolean; service: string; checkedAt: string }> {
  const response = await fetch(`${apiBaseUrl}/health`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("API indisponivel.");
  }

  return response.json();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? "E-mail ou senha invalidos." : "Nao foi possivel entrar agora.");
  }

  const body = (await response.json()) as ApiEnvelope<LoginResponse>;
  return body.data;
}
