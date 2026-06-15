import type { FastifyRequest } from "fastify";

export const demoTenantId = "00000000-0000-4000-8000-000000000001";
export const demoUserId = "00000000-0000-4000-8000-000000000101";

export interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  permissions: string[];
}

export function getRequestContext(request: FastifyRequest): RequestContext {
  const tenantHeader = request.headers["x-tenant-id"];
  const userHeader = request.headers["x-user-id"];

  return {
    tenantId: typeof tenantHeader === "string" && tenantHeader.length > 0 ? tenantHeader : demoTenantId,
    userId: typeof userHeader === "string" && userHeader.length > 0 ? userHeader : demoUserId,
    role: "owner",
    permissions: [
      "view_values",
      "approve_payout",
      "close_period",
      "create_rule",
      "activate_rule",
      "manage_companies",
      "manage_users"
    ]
  };
}
