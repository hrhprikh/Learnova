import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env")
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
