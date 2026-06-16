import crypto from "node:crypto";
import { env } from "../config/env.js";

const shopeeBaseUrl = process.env.SHOPEE_BASE_URL ?? "https://partner.shopeemobile.com";
const authPath = "/api/v2/shop/auth_partner";
const tokenPath = "/api/v2/auth/token/get";
const refreshTokenPath = "/api/v2/auth/access_token/get";

interface ShopeeState {
  tenantId: string;
  userId: string;
  nonce: string;
  exp: number;
}

interface ShopeeTokenRequest {
  code: string;
  shopId?: string;
  mainAccountId?: string;
}

function getPartnerId() {
  return process.env.SHOPEE_PARTNER_ID;
}

function getPartnerKey() {
  return process.env.SHOPEE_PARTNER_KEY;
}

function getCallbackUrl() {
  return (
    process.env.SHOPEE_REDIRECT_URI ??
    `${process.env.API_PUBLIC_URL ?? `http://localhost:${env.PORT}`}/v1/channels/shopee/auth/callback`
  );
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signHmac(input: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

function assertShopeeConfigured() {
  const partnerId = getPartnerId();
  const partnerKey = getPartnerKey();

  if (!partnerId || !partnerKey) {
    return null;
  }

  return { partnerId, partnerKey };
}

export function isShopeeConfigured() {
  return Boolean(assertShopeeConfigured());
}

export function createShopeeState(input: Pick<ShopeeState, "tenantId" | "userId">) {
  const payload: ShopeeState = {
    ...input,
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 10 * 60
  };
  const encoded = base64Url(JSON.stringify(payload));
  const signature = signHmac(encoded, env.JWT_SECRET);
  return `${encoded}.${signature}`;
}

export function verifyShopeeState(state: string): ShopeeState | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = signHmac(encoded, env.JWT_SECRET);
  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ShopeeState;
    if (!payload.tenantId || !payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildShopeeAuthorizationUrl(input: Pick<ShopeeState, "tenantId" | "userId">) {
  const config = assertShopeeConfigured();
  if (!config) {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signHmac(`${config.partnerId}${authPath}${timestamp}`, config.partnerKey);
  const callback = new URL(getCallbackUrl());
  callback.searchParams.set("state", createShopeeState(input));

  const url = new URL(`${shopeeBaseUrl}${authPath}`);
  url.searchParams.set("partner_id", config.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  url.searchParams.set("redirect", callback.toString());

  return url.toString();
}

export async function exchangeShopeeCode(input: ShopeeTokenRequest) {
  const config = assertShopeeConfigured();
  if (!config) {
    throw new Error("Shopee nao configurada.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signHmac(`${config.partnerId}${tokenPath}${timestamp}`, config.partnerKey);
  const url = new URL(`${shopeeBaseUrl}${tokenPath}`);
  url.searchParams.set("partner_id", config.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      partner_id: Number(config.partnerId),
      ...(input.shopId ? { shop_id: Number(input.shopId) } : {}),
      ...(input.mainAccountId ? { main_account_id: Number(input.mainAccountId) } : {})
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || payload.error) {
    throw new Error(String(payload.message || payload.error || "Falha ao trocar code Shopee."));
  }

  return payload;
}

export function encryptShopeeCredential(payload: Record<string, unknown>) {
  const key = crypto.createHash("sha256").update(env.JWT_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("v1:"), iv, tag, encrypted]);
}

export function getShopeeTokenExpiresAt(expireIn: unknown) {
  const seconds = Number(expireIn || 14400);
  return new Date(Date.now() + seconds * 1000);
}

export const shopeePaths = {
  authPath,
  tokenPath,
  refreshTokenPath
};
