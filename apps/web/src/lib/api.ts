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

export interface PeriodFilter {
  periodStart?: string;
  periodEnd?: string;
}

function withPeriod(path: string, period?: PeriodFilter) {
  const params = new URLSearchParams();
  if (period?.periodStart) params.set("periodStart", period.periodStart);
  if (period?.periodEnd) params.set("periodEnd", period.periodEnd);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
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

export function getDashboardSummary(session: ApiSession, period?: PeriodFilter) {
  return apiRequest<Record<string, unknown>>(withPeriod("/v1/payout-center/summary", period), session);
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

export function getPayouts(session: ApiSession, period?: PeriodFilter) {
  return apiRequest<unknown[]>(withPeriod("/v1/payout-center/payouts", period), session);
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

export async function uploadImportFile(
  session: ApiSession,
  file: File,
  input: { sourceType?: string; sourceName?: string; channelAccountId?: string } = {}
) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("sourceType", input.sourceType ?? "settlements");
  formData.set("sourceName", input.sourceName ?? file.name);
  if (input.channelAccountId) {
    formData.set("channelAccountId", input.channelAccountId);
  }

  const response = await fetch(`${apiBaseUrl}/v1/imports/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "x-tenant-id": session.tenantId
    },
    body: formData,
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : `Falha na API (${response.status}) em /v1/imports/upload.`;
    throw new Error(message);
  }

  const body = (await response.json()) as ApiEnvelope<Record<string, unknown>>;
  return body.data;
}

export async function getReconciledImportWorkbook(session: ApiSession, importId: string) {
  const response = await fetch(`${apiBaseUrl}/v1/imports/${encodeURIComponent(importId)}/reconciled.xlsx`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "x-tenant-id": session.tenantId
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : `Falha ao gerar planilha conciliada (${response.status}).`;
    throw new Error(message);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `repassify-conciliacao-${importId}.xlsx`;
  return { blob: await response.blob(), fileName };
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

export function getDreReport(session: ApiSession, period?: PeriodFilter) {
  return apiRequest<Record<string, unknown>>(withPeriod("/v1/reports/dre", period), session);
}

export function getCashflowReport(session: ApiSession, period?: PeriodFilter) {
  return apiRequest<Record<string, unknown>>(withPeriod("/v1/reports/cashflow", period), session);
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

export function sendAgentMessage(
  session: ApiSession,
  conversationId: string,
  content: string,
  context?: Record<string, unknown>
) {
  return apiRequest<Record<string, unknown>>(`/v1/agent/conversations/${conversationId}/messages`, session, {
    method: "POST",
    body: JSON.stringify({ content, context })
  });
}
