import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { authenticator } from "otplib";
import { z } from "zod";
import { env } from "../config/env.js";
import { demoTenantId, demoUserId, getRequestContext } from "../http/context.js";
import { ok } from "../http/response.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  organizationName: z.string().min(2)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(12)
});

function createSessionPayload(userId = demoUserId, tenantId = demoTenantId) {
  return {
    sub: userId,
    tenantId,
    role: "owner",
    scopes: ["view_values", "approve_payout", "close_period", "activate_rule"]
  };
}

const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);

async function signAccessToken(userId = demoUserId, tenantId = demoTenantId) {
  return new SignJWT(createSessionPayload(userId, tenantId))
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(jwtSecret);
}

async function signRefreshToken(userId = demoUserId) {
  return new SignJWT({ family: crypto.randomUUID(), tokenType: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtSecret);
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/v1/auth/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const accessToken = await signAccessToken();
    const refreshToken = await signRefreshToken();

    return reply.code(201).send(
      ok({
        user: { id: demoUserId, email: input.email, fullName: input.fullName },
        tenant: { id: demoTenantId, legalName: input.organizationName },
        accessToken,
        refreshToken,
        passwordHashPreview: `${passwordHash.slice(0, 12)}...`
      })
    );
  });

  app.post("/v1/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);
    const requiresMfa = input.email.includes("+mfa") && !input.mfaCode;

    if (requiresMfa) {
      return ok({
        mfaRequired: true,
        challengeId: crypto.randomUUID(),
        methods: ["totp", "recovery_code"]
      });
    }

    return ok({
      mfaRequired: false,
      accessToken: await signAccessToken(),
      refreshToken: await signRefreshToken(),
      expiresIn: 600
    });
  });

  app.post("/v1/auth/refresh", async (request) => {
    const input = refreshSchema.parse(request.body);
    await jwtVerify(input.refreshToken, jwtSecret);

    return ok({
      accessToken: await signAccessToken(),
      refreshToken: await signRefreshToken(),
      rotation: "previous_refresh_token_revoked"
    });
  });

  app.post("/v1/auth/logout", async () => ok({ revoked: true }));
  app.post("/v1/auth/logout-all", async () => ok({ revokedSessions: 3 }));

  app.post("/v1/auth/mfa/setup", async () => {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri("owner@repassify.local", "Repassify", secret);

    return ok({
      method: "totp",
      secret,
      otpauth,
      recoveryCodes: ["RPFY-9K2M", "RPFY-7Q4N", "RPFY-2Z8A"]
    });
  });

  app.post("/v1/auth/mfa/verify", async (request) => {
    const body = z.object({ token: z.string().min(6), secret: z.string().min(8) }).parse(request.body);
    return ok({ verified: authenticator.check(body.token, body.secret) });
  });

  app.post("/v1/auth/google/start", async () => {
    if (!env.GOOGLE_CLIENT_ID) {
      return ok({ configured: false, authorizationUrl: null });
    }

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", crypto.randomUUID());
    return ok({ configured: true, authorizationUrl: url.toString() });
  });

  app.get("/v1/auth/google/callback", async (request) => {
    const query = z.object({ code: z.string().optional(), state: z.string().optional() }).parse(request.query);
    return ok({ linked: Boolean(query.code), state: query.state ?? null });
  });

  app.get("/v1/auth/sessions", async (request) => {
    const context = getRequestContext(request);
    return ok({
      activeTenantId: context.tenantId,
      sessions: [
        { id: "session_web", userAgent: "Chrome Windows", mfaVerified: true, createdAt: "2026-06-15T14:00:00Z" },
        { id: "session_mobile", userAgent: "Mobile Safari", mfaVerified: false, createdAt: "2026-06-14T20:21:00Z" }
      ]
    });
  });

  app.delete("/v1/auth/sessions/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return ok({ revoked: true, sessionId: params.id });
  });
}
