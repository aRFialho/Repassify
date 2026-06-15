import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().default("dev-only-change-me"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3333/v1/auth/google/callback")
});

export const env = envSchema.parse(process.env);
