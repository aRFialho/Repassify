import { hasDatabase, withTenant } from "@repassify/db";
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

export async function registerImportRoutes(app: FastifyInstance) {
  app.get("/v1/imports", async (request) => {
    const context = getRequestContext(request);

    if (hasDatabase()) {
      const result = await withTenant(context.tenantId, (client) =>
        client.query(
          `SELECT id, source_type AS "sourceType", source_name AS "sourceName", file_hash AS "fileHash",
                  status, row_count AS "rowCount", error_count AS "errorCount", mapping_config AS "mappingConfig",
                  created_at AS "createdAt", processed_at AS "processedAt"
           FROM import_batches
           ORDER BY created_at DESC`,
          []
        )
      );
      return ok(result.rows);
    }

    return ok([]);
  });

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
    const sourceName = fields.sourceName?.trim() || fileName;
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
           tenant_id, source_type, source_name, file_hash, status, row_count, error_count,
           mapping_config, stats, created_by, processed_at
         )
         VALUES ($1, $2, $3, $4, 'processing', $5, $6, $7::jsonb, $8::jsonb, $9, now())
         ON CONFLICT (tenant_id, file_hash) DO UPDATE
           SET source_name = EXCLUDED.source_name,
               status = 'processing',
               row_count = EXCLUDED.row_count,
               error_count = EXCLUDED.error_count,
               mapping_config = EXCLUDED.mapping_config,
               stats = EXCLUDED.stats,
               processed_at = now()
         RETURNING id, source_type AS "sourceType", source_name AS "sourceName", file_hash AS "fileHash"` ,
        [
          context.tenantId,
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

      const batchRow = batch.rows[0] as { id: string; sourceType: string; sourceName: string; fileHash: string };

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
        const channel = await client.query<{ id: string }>(
          `INSERT INTO channel_accounts (tenant_id, provider, external_account_id, display_name, status, settings)
           VALUES ($1, $2, $3, $4, 'active', $5::jsonb)
           ON CONFLICT (tenant_id, provider, external_account_id) DO UPDATE
             SET display_name = EXCLUDED.display_name,
                 status = 'active',
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
        const channelAccountId = channel.rows[0]?.id ?? null;

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
