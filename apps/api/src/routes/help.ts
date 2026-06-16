import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { accepted, ok } from "../http/response.js";

function money(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(number) ? number : 0);
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function contextRecord(context: unknown) {
  return context && typeof context === "object" && !Array.isArray(context) ? (context as Record<string, unknown>) : {};
}

function nestedRecord(parent: Record<string, unknown>, key: string) {
  return contextRecord(parent[key]);
}

function buildAssistantReply(content: string, context: Record<string, unknown>) {
  const question = content
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const section = String(context.section ?? "Dashboard");
  const period = String(context.period ?? "Periodo atual");
  const counts = nestedRecord(context, "counts");
  const summary = nestedRecord(context, "summary");
  const cashflow = nestedRecord(context, "cashflow");
  const topIssues = Array.isArray(context.topIssues) ? context.topIssues : [];
  const issueCount = numberValue(counts.issues);
  const payoutCount = numberValue(counts.payouts);
  const importCount = numberValue(counts.imports);
  const channelCount = numberValue(counts.channels);
  const differenceAmount = numberValue(summary.differenceAmount);

  if (question.includes("diverg")) {
    if (!issueCount && Math.abs(differenceAmount) <= 0.01) {
      return `No periodo ${period}, nao ha divergencias abertas na tela ${section}. Quando houver diferenca entre liquido esperado e recebido, eu mostro o valor, a severidade e a evidencia na Auditoria.`;
    }

    const firstIssue = contextRecord(topIssues[0]);
    const issueHint = firstIssue.issueType
      ? ` Principal alerta: ${firstIssue.issueType} (${firstIssue.severity ?? "sem severidade"}) com impacto de ${money(firstIssue.amountImpact)}.`
      : "";
    return `Encontrei ${issueCount} divergencia(s) aberta(s) e diferenca total de ${money(differenceAmount)} no periodo ${period}.${issueHint} Abra Notificacoes ou Auditoria para tratar cada item.`;
  }

  if (question.includes("concili")) {
    return `A conciliacao cruza o liquido esperado com o valor recebido. Na planilha, as taxas informadas pelo canal prevalecem sobre referencias base; se faltar taxa, o repasse fica marcado para revisao. Hoje a tela tem ${importCount} import(s) e ${payoutCount} repasse(s) identificados.`;
  }

  if (question.includes("canal") || question.includes("shopee") || question.includes("marketplace")) {
    return `Existem ${channelCount} canal(is) conectado(s) e ${numberValue(counts.providers)} provedor(es) disponiveis. Para dados reais, cada canal entra por integracao OAuth/API ou por upload de planilha de conciliacao.`;
  }

  if (question.includes("taxa") || question.includes("comissao") || question.includes("fee")) {
    return `As taxas usadas no calculo vem primeiro da planilha ou integracao do canal. Nesta tela, o total de taxas identificado e ${money(summary.feeAmount)}. Se uma planilha nao trouxer taxas, o pedido/repasse fica com revisao de taxa.`;
  }

  if (question.includes("repasse") || question.includes("saldo")) {
    return `Ha ${payoutCount} repasse(s) carregados. Esperado: ${money(summary.expectedNetAmount)}. Recebido: ${money(summary.receivedAmount)}. Saldo/projecao em fluxo de caixa: ${money(cashflow.projected)}.`;
  }

  if (question.includes("period") || question.includes("data") || question.includes("calend")) {
    return `O periodo selecionado e ${period}. Use o seletor no topo da dashboard para escolher data inicial e final; depois aplique para atualizar a visao operacional.`;
  }

  return `Estou olhando a tela ${section} no periodo ${period}. Vejo ${payoutCount} repasse(s), ${importCount} import(s), ${channelCount} canal(is) e ${issueCount} divergencia(s). Posso detalhar divergencias, conciliacao, taxas, canais ou repasses.`;
}

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
    const body = z.object({ content: z.string().min(1), context: z.record(z.unknown()).optional() }).parse(request.body);
    const assistantMessage = buildAssistantReply(body.content, body.context ?? {});
    return ok({
      conversationId: params.id,
      userMessage: body.content,
      assistantMessage
    });
  });

  app.post("/v1/agent/conversations/:id/tickets", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ functionId: z.string(), title: z.string(), description: z.string(), priority: z.string().default("normal") }).parse(request.body);
    return accepted({ id: crypto.randomUUID(), conversationId: params.id, status: "open", ...body });
  });
}
