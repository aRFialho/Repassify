import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: ["req.headers.authorization", "DATABASE_URL", "token", "refreshToken", "password"]
    }
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute"
  });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }
  });

  app.get("/health", async () => ({
    ok: true,
    service: "repassify-api",
    checkedAt: new Date().toISOString()
  }));

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request_failed");

    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: "validation_error",
        issues: error.issues
      });
    }

    const message = error instanceof Error ? error.message : "Unexpected error";

    return reply.code(500).send({
      error: "internal_error",
      message: env.NODE_ENV === "production" ? "Unexpected error" : message
    });
  });

  await registerRoutes(app);

  return app;
}
