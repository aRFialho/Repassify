import { hasDatabase, withTenant } from "@repassify/db";
import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { accepted, ok } from "../http/response.js";
import { prepareSpreadsheetReconciliation } from "../services/spreadsheet-reconciliation.js";

const createImportSchema = z.object({
  sourceType: z.enum(["sales", "settlements", "bank", "fees", "ads", "returns", "generic"]),
  sourceName: z.string().min(3),
  fileName: z.string().min(3),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().optional()
});

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function componentNumber(components: unknown, key: string) {
  return components && typeof components === "object" ? numberValue((components as Record<string, unknown>)[key]) : 0;
}

function componentString(components: unknown, key: string) {
  const value = components && typeof components === "object" ? (components as Record<string, unknown>)[key] : null;
  return Array.isArray(value) ? value.join(", ") : typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function statsArray<T extends Record<string, unknown>>(stats: unknown, key: string): T[] {
  const value = stats && typeof stats === "object" ? (stats as Record<string, unknown>)[key] : null;
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as T[]) : [];
}

function addCurrencyColumns(sheet: ExcelJS.Worksheet, columns: number[]) {
  for (const columnIndex of columns) {
    sheet.getColumn(columnIndex).numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  }
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF082D85" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount }
  };

  for (const column of sheet.columns) {
    let width = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      width = Math.max(width, String(cell.value ?? "").length + 2);
    });
    column.width = Math.min(width, 42);
  }
}

export async function registerImportRoutes(app: FastifyInstance) {
  app.get("/v1/imports", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      try {
        const result = await withTenant(context.tenantId, (client) =>
          client.query(
            `SELECT id, source_type AS "sourceType", source_name AS "sourceName", file_hash AS "fileHash",
                    import_batches.channel_account_id AS "channelAccountId",
                    channel_accounts.provider AS channel,
                    channel_accounts.display_name AS "channelDisplayName",
                    status, row_count AS "rowCount", error_count AS "errorCount", mapping_config AS "mappingConfig",
                    import_batches.stats,
                    import_batches.created_at AS "createdAt", import_batches.processed_at AS "processedAt"
             FROM import_batches
             LEFT JOIN channel_accounts ON channel_accounts.id = import_batches.channel_account_id
             ORDER BY import_batches.created_at DESC`,
            []
          )
        );
        return ok(result.rows);
      } catch (error) {
        request.log.error({ err: error }, "imports_listing_join_failed");
        const fallback = await withTenant(context.tenantId, (client) =>
          client.query(
            `SELECT id, source_type AS "sourceType", source_name AS "sourceName", file_hash AS "fileHash",
                    NULL::uuid AS "channelAccountId",
                    NULL::text AS channel,
                    NULL::text AS "channelDisplayName",
                    status, row_count AS "rowCount", error_count AS "errorCount", mapping_config AS "mappingConfig",
                    stats, created_at AS "createdAt", processed_at AS "processedAt"
             FROM import_batches
             ORDER BY created_at DESC`,
            []
          )
        );
        return ok(fallback.rows);
      }
    }

    return ok([]);
  });

  app.get("/v1/imports/upload", async (_request, reply) =>
    reply.code(405).send({
      error: "method_not_allowed",
      message: "Upload de planilha usa POST multipart/form-data neste endpoint.",
      method: "POST",
      fields: ["file", "sourceType", "sourceName", "channelAccountId"]
    })
  );

  app.post("/v1/imports/upload", async (request, reply) => {
    const context = getRequestContext(request);
    const fields: Record<string, string> = {};
    let fileName = "";
    let mimeType = "";
    let buffer: Buffer | null = null;

    for await (const part of request.parts()) {
      if (part.type === "file") {
        fileName = part.filename;
        mimeType = part.mimetype;
        buffer = await part.toBuffer();
      } else {
        fields[part.fieldname] = String(part.value ?? "");
      }
    }

    if (!buffer || !fileName) {
      return reply.code(400).send({ error: "file_required", message: "Envie uma planilha para conciliacao." });
    }

    const sourceType = z
      .enum(["sales", "settlements", "bank", "fees", "ads", "returns", "generic"])
      .default("settlements")
      .parse(fields.sourceType || "settlements");
    const requestedChannelAccountId = fields.channelAccountId?.trim();
    let targetChannel: { id: string; provider: string; displayName: string } | null = null;

    if (requestedChannelAccountId && hasDatabase()) {
      const channelResult = await withTenant(context.tenantId, (client) =>
        client.query<{ id: string; provider: string; displayName: string }>(
          `SELECT id, provider, display_name AS "displayName"
           FROM channel_accounts
           WHERE tenant_id = $1 AND id = $2`,
          [context.tenantId, requestedChannelAccountId]
        )
      );
      targetChannel = channelResult.rows[0] ?? null;

      if (!targetChannel) {
        request.log.warn(
          { channelAccountId: requestedChannelAccountId },
          "spreadsheet_upload_channel_not_found_continuing_without_link"
        );
      }
    }

    const sourceName = targetChannel?.displayName ?? fields.sourceName?.trim() ?? fileName;
    let prepared;

    try {
      prepared = await prepareSpreadsheetReconciliation({ buffer, fileName, sourceName });
    } catch (error) {
      return reply.code(400).send({
        error: "spreadsheet_parse_failed",
        message: error instanceof Error ? error.message : "Nao foi possivel ler a planilha."
      });
    }

    const sha256 = String(prepared.stats.sha256);

    if (!hasDatabase()) {
      return reply.code(201).send(
        ok({
          id: crypto.randomUUID(),
          sourceType,
          sourceName,
          channelAccountId: requestedChannelAccountId ?? null,
          channel: targetChannel?.provider ?? null,
          channelDisplayName: targetChannel?.displayName ?? null,
          fileHash: sha256,
          status: "processed",
          rowCount: prepared.rawRows.length,
          errorCount: prepared.errors.length,
          mappingConfig: prepared.mapping,
          stats: prepared.stats,
          payoutsCreated: prepared.payouts.length
        })
      );
    }

    const result = await withTenant(context.tenantId, async (client) => {
      const batch = await client.query(
        `INSERT INTO import_batches (
           tenant_id, channel_account_id, source_type, source_name, file_hash, status, row_count, error_count,
           mapping_config, stats, created_by, processed_at
         )
         VALUES ($1, $2, $3, $4, $5, 'processing', $6, $7, $8::jsonb, $9::jsonb, $10, now())
         ON CONFLICT (tenant_id, file_hash) DO UPDATE
           SET channel_account_id = EXCLUDED.channel_account_id,
               source_name = EXCLUDED.source_name,
               status = 'processing',
               row_count = EXCLUDED.row_count,
               error_count = EXCLUDED.error_count,
               mapping_config = EXCLUDED.mapping_config,
               stats = EXCLUDED.stats,
               processed_at = now()
         RETURNING id, source_type AS "sourceType", source_name AS "sourceName", file_hash AS "fileHash",
                   channel_account_id AS "channelAccountId"` ,
        [
          context.tenantId,
          targetChannel?.id ?? null,
          sourceType,
          sourceName,
          sha256,
          prepared.rawRows.length,
          prepared.errors.length,
          JSON.stringify(prepared.mapping),
          JSON.stringify(prepared.stats),
          context.userId
        ]
      );

      const batchRow = batch.rows[0] as {
        id: string;
        sourceType: string;
        sourceName: string;
        fileHash: string;
        channelAccountId: string | null;
      };

      await client.query(
        `INSERT INTO import_files (tenant_id, batch_id, original_filename, storage_key, mime_type, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id, sha256) DO UPDATE
           SET batch_id = EXCLUDED.batch_id,
               original_filename = EXCLUDED.original_filename,
               mime_type = EXCLUDED.mime_type,
               size_bytes = EXCLUDED.size_bytes`,
        [context.tenantId, batchRow.id, fileName, `inline:${sha256}`, mimeType, buffer.length, sha256]
      );

      await client.query("DELETE FROM raw_records WHERE tenant_id = $1 AND batch_id = $2", [context.tenantId, batchRow.id]);

      for (const row of prepared.rawRows) {
        const normalizedHash = createHash("sha256").update(JSON.stringify(row.values)).digest("hex");
        await client.query(
          `INSERT INTO raw_records (tenant_id, batch_id, record_type, row_number, source_payload, normalized_hash, error_payload)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)`,
          [
            context.tenantId,
            batchRow.id,
            sourceType,
            row.rowNumber,
            JSON.stringify(row.values),
            normalizedHash,
            JSON.stringify(prepared.errors.filter((error) => error.rowNumber === row.rowNumber))
          ]
        );
      }

      let issueCount = 0;

      for (const payout of prepared.payouts) {
        let channelAccountId = targetChannel?.id ?? null;

        if (!channelAccountId) {
          const channel = await client.query<{ id: string }>(
            `INSERT INTO channel_accounts (tenant_id, provider, external_account_id, display_name, status, settings)
             VALUES ($1, $2, $3, $4, 'spreadsheet_only', $5::jsonb)
             ON CONFLICT (tenant_id, provider, external_account_id) DO UPDATE
               SET display_name = EXCLUDED.display_name,
                   status = CASE
                     WHEN channel_accounts.status = 'active' THEN 'active'
                     ELSE 'spreadsheet_only'
                   END,
                   settings = channel_accounts.settings || EXCLUDED.settings,
                   updated_at = now()
             RETURNING id`,
            [
              context.tenantId,
              payout.channel,
              payout.channel.toLowerCase().replace(/\s+/g, "_"),
              payout.channel,
              JSON.stringify({ connected_by: "spreadsheet", last_import_batch_id: batchRow.id })
            ]
          );
          channelAccountId = channel.rows[0]?.id ?? null;
        }

        const savedPayout = await client.query<{ id: string }>(
          `INSERT INTO payouts (
             tenant_id, channel_account_id, payout_number, period_start, period_end,
             expected_amount, received_amount, difference_amount, retained_amount, status, components
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
           ON CONFLICT (tenant_id, payout_number) DO UPDATE
             SET channel_account_id = EXCLUDED.channel_account_id,
                 period_start = EXCLUDED.period_start,
                 period_end = EXCLUDED.period_end,
                 expected_amount = EXCLUDED.expected_amount,
                 received_amount = EXCLUDED.received_amount,
                 difference_amount = EXCLUDED.difference_amount,
                 retained_amount = EXCLUDED.retained_amount,
                 status = EXCLUDED.status,
                 components = EXCLUDED.components,
                 updated_at = now()
           RETURNING id`,
          [
            context.tenantId,
            channelAccountId,
            payout.payoutNumber,
            payout.periodStart,
            payout.periodEnd,
            payout.expectedAmount,
            payout.receivedAmount,
            payout.differenceAmount,
            payout.retainedAmount,
            payout.status,
            JSON.stringify({ ...payout.components, importBatchId: batchRow.id, sourceRows: payout.sourceRows })
          ]
        );
        const payoutId = savedPayout.rows[0]?.id;

        if (!payoutId) {
          continue;
        }

        await client.query(
          `DELETE FROM reconciliation_issues
           WHERE tenant_id = $1
             AND payout_id = $2
             AND issue_type = ANY($3::text[])
             AND status IN ('open', 'in_review')`,
          [
            context.tenantId,
            payoutId,
            ["underpaid_payout", "overpaid_payout", "needs_fee_review", "fee_above_gross", "retained_amount"]
          ]
        );

        for (const issue of prepared.issuesByPayout.get(payout.payoutNumber) ?? []) {
          issueCount += 1;
          await client.query(
            `INSERT INTO reconciliation_issues (
               tenant_id, payout_id, issue_type, severity, amount_impact, status, explanation, evidence
             )
             VALUES ($1, $2, $3, $4, $5, 'open', $6, $7::jsonb)`,
            [
              context.tenantId,
              payoutId,
              issue.issueType,
              issue.severity,
              issue.amountImpact,
              issue.explanation,
              JSON.stringify(issue.evidence)
            ]
          );
        }
      }

      const finalStats = { ...prepared.stats, issuesCreated: issueCount, payoutsUpserted: prepared.payouts.length };
      const finalBatch = await client.query(
        `UPDATE import_batches
         SET status = 'processed',
             stats = $3::jsonb,
             processed_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, source_type AS "sourceType", source_name AS "sourceName", file_hash AS "fileHash",
                   status, row_count AS "rowCount", error_count AS "errorCount",
                   mapping_config AS "mappingConfig", stats, processed_at AS "processedAt"`,
        [context.tenantId, batchRow.id, JSON.stringify(finalStats)]
      );

      return finalBatch.rows[0];
    });

    return reply.code(201).send(ok(result));
  });

  app.get("/v1/imports/:id/reconciled.xlsx", async (request, reply) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);

    if (!hasDatabase()) {
      return reply.code(404).send({ error: "export_unavailable", message: "Exportacao disponivel apenas com banco ativo." });
    }

    const data = await withTenant(context.tenantId, async (client) => {
      const batch = await client.query(
        `SELECT id, source_name AS "sourceName", file_hash AS "fileHash", row_count AS "rowCount",
                error_count AS "errorCount", stats, processed_at AS "processedAt"
         FROM import_batches
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, params.id]
      );

      const batchRow = batch.rows[0];
      if (!batchRow) {
        return null;
      }

      const payouts = await client.query(
        `SELECT payouts.id,
                payouts.payout_number AS "payoutNumber",
                COALESCE(channel_accounts.provider, 'Sem canal') AS channel,
                COALESCE(companies.trade_name, companies.legal_name, 'Sem empresa') AS company,
                payouts.period_start AS "periodStart",
                payouts.period_end AS "periodEnd",
                payouts.expected_amount::float AS "expectedAmount",
                payouts.received_amount::float AS "receivedAmount",
                payouts.difference_amount::float AS "differenceAmount",
                payouts.retained_amount::float AS "retainedAmount",
                payouts.status,
                payouts.components
         FROM payouts
         LEFT JOIN channel_accounts ON channel_accounts.id = payouts.channel_account_id
         LEFT JOIN companies ON companies.id = payouts.company_id
         WHERE payouts.tenant_id = $1
           AND payouts.components->>'importBatchId' = $2
         ORDER BY payouts.payout_number`,
        [context.tenantId, params.id]
      );

      const issues = await client.query(
        `SELECT reconciliation_issues.id,
                payouts.payout_number AS "payoutNumber",
                reconciliation_issues.issue_type AS "issueType",
                reconciliation_issues.severity,
                reconciliation_issues.amount_impact::float AS "amountImpact",
                reconciliation_issues.status,
                reconciliation_issues.explanation,
                reconciliation_issues.evidence
         FROM reconciliation_issues
         JOIN payouts ON payouts.id = reconciliation_issues.payout_id
         WHERE reconciliation_issues.tenant_id = $1
           AND payouts.components->>'importBatchId' = $2
         ORDER BY reconciliation_issues.created_at DESC`,
        [context.tenantId, params.id]
      );

      return { batch: batchRow, payouts: payouts.rows, issues: issues.rows };
    });

    if (!data) {
      return reply.code(404).send({ error: "import_not_found", message: "Importacao nao encontrada." });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Repassify";
    workbook.created = new Date();
    workbook.modified = new Date();

    const detail = workbook.addWorksheet("Detalhado");
    detail.columns = [
      { header: "Repasse", key: "payoutNumber" },
      { header: "Canal", key: "channel" },
      { header: "Empresa", key: "company" },
      { header: "Periodo inicio", key: "periodStart" },
      { header: "Periodo fim", key: "periodEnd" },
      { header: "Valor bruto", key: "gross" },
      { header: "Taxas", key: "fee" },
      { header: "Frete", key: "shipping" },
      { header: "Ads/Campanhas", key: "ads" },
      { header: "Devolucoes", key: "refund" },
      { header: "Margem", key: "margin" },
      { header: "Liquido esperado", key: "expectedAmount" },
      { header: "Recebido", key: "receivedAmount" },
      { header: "Diferenca", key: "differenceAmount" },
      { header: "Retido", key: "retainedAmount" },
      { header: "Status", key: "status" },
      { header: "Pedidos", key: "orderNumbers" },
      { header: "Linhas origem", key: "sourceRows" }
    ];

    for (const payout of data.payouts) {
      detail.addRow({
        payoutNumber: payout.payoutNumber,
        channel: payout.channel,
        company: payout.company,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
        gross: componentNumber(payout.components, "gross"),
        fee: componentNumber(payout.components, "fee"),
        shipping: componentNumber(payout.components, "shipping"),
        ads: componentNumber(payout.components, "ads"),
        refund: componentNumber(payout.components, "refund"),
        margin: componentNumber(payout.components, "margin"),
        expectedAmount: numberValue(payout.expectedAmount),
        receivedAmount: numberValue(payout.receivedAmount),
        differenceAmount: numberValue(payout.differenceAmount),
        retainedAmount: numberValue(payout.retainedAmount),
        status: payout.status,
        orderNumbers: componentString(payout.components, "orderNumbers"),
        sourceRows: componentString(payout.components, "sourceRows")
      });
    }
    addCurrencyColumns(detail, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    styleSheet(detail);

    const categorySummary = statsArray(data.batch.stats, "categorySummary");
    if (categorySummary.length) {
      const categories = workbook.addWorksheet("Resumo Categorias");
      categories.columns = [
        { header: "Categoria", key: "category" },
        { header: "Lancamentos", key: "count" },
        { header: "Receita liquida", key: "revenueNet" },
        { header: "Despesa liquida", key: "expenseNet" },
        { header: "Resultado final", key: "finalAmount" },
        { header: "Peso despesas %", key: "expenseWeightPct" }
      ];
      for (const item of categorySummary) {
        categories.addRow({
          category: item.category,
          count: numberValue(item.count),
          revenueNet: numberValue(item.revenueNet),
          expenseNet: numberValue(item.expenseNet),
          finalAmount: numberValue(item.finalAmount),
          expenseWeightPct: numberValue(item.expenseWeightPct) / 100
        });
      }
      addCurrencyColumns(categories, [3, 4, 5]);
      categories.getColumn(6).numFmt = "0.00%";
      styleSheet(categories);
    }

    const launchSummary = statsArray(data.batch.stats, "launchSummary");
    if (launchSummary.length) {
      const launches = workbook.addWorksheet("Resumo Lancamentos");
      launches.columns = [
        { header: "Lancamento", key: "launchName" },
        { header: "Categoria", key: "category" },
        { header: "Quantidade", key: "count" },
        { header: "Valor previsto", key: "expectedAmount" },
        { header: "Valor repasse", key: "receivedAmount" },
        { header: "Diferenca", key: "differenceAmount" }
      ];
      for (const item of launchSummary) {
        launches.addRow({
          launchName: item.launchName,
          category: item.category,
          count: numberValue(item.count),
          expectedAmount: numberValue(item.expectedAmount),
          receivedAmount: numberValue(item.receivedAmount),
          differenceAmount: numberValue(item.differenceAmount)
        });
      }
      addCurrencyColumns(launches, [4, 5, 6]);
      styleSheet(launches);
    }

    const statusSummary = statsArray(data.batch.stats, "statusSummary");
    if (statusSummary.length) {
      const statuses = workbook.addWorksheet("Resumo Status");
      statuses.columns = [
        { header: "Status", key: "status" },
        { header: "Quantidade", key: "count" }
      ];
      for (const item of statusSummary) {
        statuses.addRow({ status: item.status, count: numberValue(item.count) });
      }
      styleSheet(statuses);
    }

    const reconciliationRows = statsArray(data.batch.stats, "reconciliationRows");
    if (reconciliationRows.length) {
      const launchesDetail = workbook.addWorksheet("Lancamentos");
      launchesDetail.columns = [
        { header: "Conciliacao", key: "conciliationId" },
        { header: "Pedido / Ref. pedido", key: "orderNumber" },
        { header: "Canal", key: "channel" },
        { header: "Conta", key: "account" },
        { header: "Data pedido", key: "orderDate" },
        { header: "Data prevista", key: "expectedDate" },
        { header: "Data repasse", key: "settlementDate" },
        { header: "Parcela", key: "installment" },
        { header: "Lancamento", key: "launchName" },
        { header: "Categoria", key: "category" },
        { header: "Valor previsto", key: "expectedAmount" },
        { header: "Valor repasse", key: "receivedAmount" },
        { header: "Diferenca", key: "differenceAmount" },
        { header: "Status", key: "status" },
        { header: "Critica", key: "critique" },
        { header: "Linha origem", key: "rowNumber" }
      ];
      for (const item of reconciliationRows) {
        launchesDetail.addRow({
          conciliationId: item.conciliationId,
          orderNumber: item.orderNumber,
          channel: item.channel,
          account: item.account,
          orderDate: item.orderDate,
          expectedDate: item.expectedDate,
          settlementDate: item.settlementDate,
          installment: item.installment,
          launchName: item.launchName,
          category: item.category,
          expectedAmount: numberValue(item.expectedAmount),
          receivedAmount: numberValue(item.receivedAmount),
          differenceAmount: numberValue(item.differenceAmount),
          status: item.status,
          critique: item.critique,
          rowNumber: numberValue(item.rowNumber)
        });
      }
      addCurrencyColumns(launchesDetail, [11, 12, 13]);
      styleSheet(launchesDetail);
    }

    const issues = workbook.addWorksheet("Divergencias");
    issues.columns = [
      { header: "Repasse", key: "payoutNumber" },
      { header: "Tipo", key: "issueType" },
      { header: "Severidade", key: "severity" },
      { header: "Impacto", key: "amountImpact" },
      { header: "Status", key: "status" },
      { header: "Explicacao", key: "explanation" },
      { header: "Evidencias", key: "evidence" }
    ];
    for (const issue of data.issues) {
      issues.addRow({
        payoutNumber: issue.payoutNumber,
        issueType: issue.issueType,
        severity: issue.severity,
        amountImpact: numberValue(issue.amountImpact),
        status: issue.status,
        explanation: issue.explanation,
        evidence: Array.isArray(issue.evidence)
          ? issue.evidence
              .map((item: unknown) => {
                const evidence = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                return `${String(evidence.label ?? "evidencia")}: ${String(evidence.value ?? "")}`;
              })
              .join(" | ")
          : JSON.stringify(issue.evidence ?? [])
      });
    }
    addCurrencyColumns(issues, [4]);
    styleSheet(issues);

    const totals = data.payouts.reduce(
      (acc, payout) => ({
        gross: acc.gross + componentNumber(payout.components, "gross"),
        fee: acc.fee + componentNumber(payout.components, "fee"),
        shipping: acc.shipping + componentNumber(payout.components, "shipping"),
        ads: acc.ads + componentNumber(payout.components, "ads"),
        refund: acc.refund + componentNumber(payout.components, "refund"),
        margin: acc.margin + componentNumber(payout.components, "margin"),
        expectedAmount: acc.expectedAmount + numberValue(payout.expectedAmount),
        receivedAmount: acc.receivedAmount + numberValue(payout.receivedAmount),
        differenceAmount: acc.differenceAmount + numberValue(payout.differenceAmount),
        retainedAmount: acc.retainedAmount + numberValue(payout.retainedAmount)
      }),
      {
        gross: 0,
        fee: 0,
        shipping: 0,
        ads: 0,
        refund: 0,
        margin: 0,
        expectedAmount: 0,
        receivedAmount: 0,
        differenceAmount: 0,
        retainedAmount: 0
      }
    );

    const summary = workbook.addWorksheet("Totais");
    summary.columns = [
      { header: "Indicador", key: "label" },
      { header: "Valor", key: "value" }
    ];
    [
      ["Origem", data.batch.sourceName],
      ["Arquivo hash", data.batch.fileHash],
      ["Linhas importadas", numberValue(data.batch.rowCount)],
      ["Alertas de leitura", numberValue(data.batch.errorCount)],
      ["Repasses conciliados", data.payouts.length],
      ["Divergencias geradas", data.issues.length],
      ["Valor bruto", totals.gross],
      ["Taxas", totals.fee],
      ["Frete", totals.shipping],
      ["Ads/Campanhas", totals.ads],
      ["Devolucoes", totals.refund],
      ["Liquido esperado", totals.expectedAmount],
      ["Recebido", totals.receivedAmount],
      ["Diferenca", totals.differenceAmount],
      ["Retido", totals.retainedAmount],
      ["Margem", totals.margin]
    ].forEach(([label, value]) => summary.addRow({ label, value }));
    for (let rowIndex = 7; rowIndex <= summary.rowCount; rowIndex += 1) {
      summary.getCell(rowIndex, 2).numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
    }
    styleSheet(summary);

    const generated = await workbook.xlsx.writeBuffer();
    const fileName = `repassify-conciliacao-${params.id}.xlsx`;

    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${fileName}"`)
      .send(Buffer.from(generated));
  });

  app.post("/v1/imports", async (request, reply) => {
    const context = getRequestContext(request);
    const input = createImportSchema.parse(request.body);
    const sha256 = input.sha256 ?? createHash("sha256").update(`${input.fileName}:${input.sizeBytes}`).digest("hex");

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `INSERT INTO import_batches (tenant_id, source_type, source_name, file_hash, status, row_count, stats)
           VALUES ($1, $2, $3, $4, 'mapping', 0, $5::jsonb)
           ON CONFLICT (tenant_id, file_hash) DO UPDATE
             SET source_name = EXCLUDED.source_name
           RETURNING id, source_type AS "sourceType", source_name AS "sourceName", file_hash AS "fileHash",
                     status, row_count AS "rowCount", error_count AS "errorCount", created_at AS "createdAt"`,
          [
            context.tenantId,
            input.sourceType,
            input.sourceName,
            sha256,
            JSON.stringify({ fileName: input.fileName, sizeBytes: input.sizeBytes })
          ]
        )
      );

      return reply.code(201).send(ok(result.rows[0]));
    }

    return reply.code(201).send(
      ok({
        id: crypto.randomUUID(),
        ...input,
        sha256,
        status: "mapping"
      })
    );
  });

  app.post("/v1/imports/:id/preview", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok({
      importId: params.id,
      detectedTemplate: null,
      delimiter: null,
      encoding: null,
      currency: "BRL",
      requiredFields: ["order_number", "gross_amount", "fee_amount", "shipping_amount", "net_amount"],
      sampleRows: [],
      errors: []
    });
  });

  app.post("/v1/imports/:id/confirm", async (request) => {
    const context = getRequestContext(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const mapping = z.record(z.string()).parse(request.body ?? {});

    if (hasDatabase()) {
      await withTenant(context.tenantId, (client) =>
        client.query(
          `UPDATE import_batches
           SET mapping_config = $3::jsonb, status = 'queued'
           WHERE tenant_id = $1 AND id = $2`,
          [context.tenantId, params.id, JSON.stringify(mapping)]
        )
      );
    }

    return accepted({ importId: params.id, mapping, jobId: crypto.randomUUID(), status: "queued" });
  });
}
