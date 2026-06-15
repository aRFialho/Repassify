import { hasDatabase, withTenant } from "@repassify/db";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getRequestContext } from "../http/context.js";
import { accepted, ok } from "../http/response.js";

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
