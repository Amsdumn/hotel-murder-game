import { z } from "zod";

const serverEnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BIND_HOST: z.string().min(1).default("0.0.0.0"),
});

const databaseEnvSchema = z.object({
  MONGODB_URI: z.string().url().refine((uri) => uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"), "Expected a MongoDB URI"),
});

export function getServerEnv(source: Record<string, string | undefined> = process.env) {
  return serverEnvSchema.parse(source);
}

export function getDatabaseEnv(source: Record<string, string | undefined> = process.env) {
  return databaseEnvSchema.parse(source);
}
