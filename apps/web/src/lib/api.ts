const fallbackApiBaseUrl =
  process.env.NODE_ENV === "production" ? "https://repassify-api.onrender.com" : "http://localhost:3333";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? fallbackApiBaseUrl;

export interface LoginResponse {
  mfaRequired: boolean;
  user: { id: string; email: string; fullName: string };
  tenant: { id: string; legalName: string };
  role: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiSession {
  accessToken: string;
  tenantId: string;
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

export async function apiRequest<T>(
  path: string,
  session: ApiSession,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      "x-tenant-id": session.tenantId,
      ...(options.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Falha na API (${response.status}) em ${path}.`);
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  return body.data;
}

export function getDashboardSummary(session: ApiSession) {
  return apiRequest<Record<string, unknown>>("/v1/payout-center/summary", session);
}

export function getChannelProviders(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/channels/providers", session);
}

export function startChannelAuth(session: ApiSession, provider: string) {
  return apiRequest<Record<string, unknown>>(`/v1/channels/${encodeURIComponent(provider)}/auth/start`, session);
}

export function syncChannel(session: ApiSession, provider: string) {
  return apiRequest<Record<string, unknown>>(`/v1/channels/${encodeURIComponent(provider)}/sync`, session, {
    method: "POST"
  });
}

export function getPayouts(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/payout-center/payouts", session);
}

export function getImports(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/imports", session);
}

export function createImport(
  session: ApiSession,
  input: { sourceType: string; sourceName: string; fileName: string; sizeBytes: number }
) {
  return apiRequest<Record<string, unknown>>("/v1/imports", session, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function previewImport(session: ApiSession, importId: string) {
  return apiRequest<Record<string, unknown>>(`/v1/imports/${importId}/preview`, session, { method: "POST" });
}

export function confirmImport(session: ApiSession, importId: string, mapping: Record<string, string>) {
  return apiRequest<Record<string, unknown>>(`/v1/imports/${importId}/confirm`, session, {
    method: "POST",
    body: JSON.stringify(mapping)
  });
}

export function getRules(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/rules", session);
}

export function createRule(session: ApiSession, input: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>("/v1/rules", session, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function simulateRule(session: ApiSession, ruleId: string) {
  return apiRequest<unknown[]>(`/v1/rules/${ruleId}/simulate`, session, { method: "POST" });
}

export function getCompanies(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/companies", session);
}

export function createCompany(session: ApiSession, input: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>("/v1/companies", session, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getChannels(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/channels", session);
}

export function createChannel(session: ApiSession, input: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>("/v1/channels", session, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getIssues(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/issues", session);
}

export function updateIssue(session: ApiSession, issueId: string, status: string) {
  return apiRequest<Record<string, unknown>>(`/v1/issues/${issueId}`, session, {
    method: "PATCH",
    body: JSON.stringify({ status, resolutionNote: "Atualizado pelo cockpit web." })
  });
}

export function runReconciliation(session: ApiSession) {
  return apiRequest<Record<string, unknown>>("/v1/reconciliation-runs", session, {
    method: "POST",
    body: JSON.stringify({ periodStart: "2026-06-01", periodEnd: "2026-06-30", strategy: "deterministic_v1" })
  });
}

export function getDreReport(session: ApiSession) {
  return apiRequest<Record<string, unknown>>("/v1/reports/dre", session);
}

export function getCashflowReport(session: ApiSession) {
  return apiRequest<Record<string, unknown>>("/v1/reports/cashflow", session);
}

export function exportErp(session: ApiSession) {
  return apiRequest<Record<string, unknown>>("/v1/exports/erp", session, { method: "POST" });
}

export function getTenant(session: ApiSession) {
  return apiRequest<Record<string, unknown>>("/v1/tenants/current", session);
}

export function getUsers(session: ApiSession) {
  return apiRequest<unknown[]>("/v1/users", session);
}

export function inviteUser(session: ApiSession, input: { email: string; role: string }) {
  return apiRequest<Record<string, unknown>>("/v1/users/invites", session, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function createAgentConversation(session: ApiSession, input: { functionId: string; title: string }) {
  return apiRequest<Record<string, unknown>>("/v1/agent/conversations", session, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function sendAgentMessage(session: ApiSession, conversationId: string, content: string) {
  return apiRequest<Record<string, unknown>>(`/v1/agent/conversations/${conversationId}/messages`, session, {
    method: "POST",
    body: JSON.stringify({ content })
  });
}
