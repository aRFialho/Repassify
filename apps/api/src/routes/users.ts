import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.string().min(2)
});

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/v1/users", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT users.id, users.email, users.full_name AS "fullName",
                  tenant_memberships.role::text AS role,
                  tenant_memberships.status,
                  tenant_memberships.permissions
           FROM tenant_memberships
           JOIN users ON users.id = tenant_memberships.user_id
           ORDER BY users.created_at DESC`,
          []
        )
      );
      return ok(result.rows);
    }

    return ok([]);
  });

  app.post("/v1/users/invites", async (request, reply) => {
    const input = inviteSchema.parse(request.body);
    return reply.code(201).send(
      ok({
        id: crypto.randomUUID(),
        ...input,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString()
      })
    );
  });

  app.patch("/v1/users/:id/role", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ role: z.string().min(2) }).parse(request.body);
    return ok({ id: params.id, role: body.role, auditLog: "user.role_changed" });
  });

  app.patch("/v1/users/:id/status", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ status: z.enum(["active", "inactive", "revoked"]) }).parse(request.body);
    return ok({ id: params.id, status: body.status, auditLog: "user.status_changed" });
  });
}
