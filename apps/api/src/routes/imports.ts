import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { accepted, ok } from "../http/response.js";
import { demoState } from "../repositories/demo.js";

const createImportSchema = z.object({
  sourceType: z.enum(["sales", "settlements", "bank", "fees", "ads", "returns", "generic"]),
  sourceName: z.string().min(3),
  fileName: z.string().min(3),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().optional()
});

export async function registerImportRoutes(app: FastifyInstance) {
  app.get("/v1/imports", async () => ok(demoState.imports));

  app.post("/v1/imports", async (request, reply) => {
    const input = createImportSchema.parse(request.body);
    const sha256 = input.sha256 ?? createHash("sha256").update(`${input.fileName}:${input.sizeBytes}`).digest("hex");
    const alreadyExists = demoState.imports.some((item) => item.fileHash === sha256);

    return reply.code(alreadyExists ? 200 : 201).send(
      ok({
        id: alreadyExists ? "import_existing" : crypto.randomUUID(),
        ...input,
        sha256,
        status: alreadyExists ? "uploaded" : "mapping",
        idempotent: alreadyExists,
        upload: {
          mode: "local-dev",
          storageKey: `tenants/demo/imports/${sha256}/${input.fileName}`
        }
      })
    );
  });

  app.post("/v1/imports/:id/preview", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok({
      importId: params.id,
      detectedTemplate: "Shopee Settlement v2026",
      delimiter: ";",
      encoding: "utf-8",
      currency: "BRL",
      requiredFields: ["order_number", "gross_amount", "fee_amount", "shipping_amount", "net_amount"],
      sampleRows: [
        { order_number: "SHP-1001", gross_amount: "840,00", shipping_amount: "64,90", net_amount: "589,70" },
        { order_number: "SHP-1002", gross_amount: "129,90", shipping_amount: "22,50", net_amount: "83,42" }
      ],
      errors: [{ row: 17, field: "settlement_date", message: "Data fora do padrao esperado" }]
    });
  });

  app.post("/v1/imports/:id/confirm", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const mapping = z.record(z.string()).parse(request.body ?? {});
    return accepted({ importId: params.id, mapping, jobId: crypto.randomUUID(), status: "queued" });
  });
}
