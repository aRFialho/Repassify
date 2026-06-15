import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { accepted, ok } from "../http/response.js";

export async function registerHelpRoutes(app: FastifyInstance) {
  app.get("/v1/help/functions/:functionId", async (request, reply) => {
    const context = getRequestContext(request);
    const params = z.object({ functionId: z.string() }).parse(request.params);

    const doc = hasDatabase()
      ? (
          await withTenant(context.tenantId, (client) =>
            client.query(
              `SELECT id, module, title, objective, prerequisites, steps, common_errors AS "commonErrors",
                      permissions, acceptance_criteria AS "acceptanceCriteria", updated_at AS "updatedAt"
               FROM function_docs
               WHERE id = $1`,
              [params.functionId]
            )
          )
        ).rows[0]
      : null;

    if (!doc) {
      return reply.code(404).send({ error: "function_not_found" });
    }

    return ok(doc);
  });

  app.post("/v1/agent/conversations", async (request, reply) => {
    const body = z.object({ functionId: z.string(), title: z.string().min(2) }).parse(request.body);
    return reply.code(201).send(ok({ id: crypto.randomUUID(), status: "open", ...body }));
  });

  app.post("/v1/agent/conversations/:id/messages", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ content: z.string().min(1) }).parse(request.body);
    return ok({
      conversationId: params.id,
      userMessage: body.content,
      assistantMessage:
        "Analisei o contexto da tela. Posso explicar o calculo, listar evidencias ou preparar uma acao, mas acoes financeiras sensiveis exigem confirmacao explicita."
    });
  });

  app.post("/v1/agent/conversations/:id/tickets", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ functionId: z.string(), title: z.string(), description: z.string(), priority: z.string().default("normal") }).parse(request.body);
    return accepted({ id: crypto.randomUUID(), conversationId: params.id, status: "open", ...body });
  });
}
