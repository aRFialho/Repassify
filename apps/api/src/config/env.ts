import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().default("dev-only-change-me"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3333/v1/auth/google/callback"),
  API_PUBLIC_URL: z.string().optional(),
  SHOPEE_BASE_URL: z.string().optional(),
  SHOPEE_PARTNER_ID: z.string().optional(),
  SHOPEE_PARTNER_KEY: z.string().optional(),
  SHOPEE_REDIRECT_URI: z.string().optional()
});

export const env = envSchema.parse(process.env);
