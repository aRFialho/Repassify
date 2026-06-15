import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../http/response.js";
import { demoState } from "../repositories/demo.js";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.string().min(2)
});

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/v1/users", async () => ok(demoState.users));

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
