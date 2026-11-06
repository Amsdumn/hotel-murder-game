import { z } from "zod";

const serverEnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BIND_HOST: z.string().min(1).default("0.0.0.0"),
});

const databaseEnvSchema = z.object({
  MONGODB_URI: z.string().url().refine((uri) => uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"), "Expected a MongoDB URI"),
});
const developmentMongoModeSchema = z.enum(["local", "docker", "custom"]);
const developmentMongoUris = {
  local: "mongodb://127.0.0.1:27017/hotel-murder-online",
  docker: "mongodb://127.0.0.1:27018/hotel-murder-online",
};

export function getServerEnv(source: Record<string, string | undefined> = process.env) {
  return serverEnvSchema.parse(source);
}

export function getDatabaseEnv(source: Record<string, string | undefined> = process.env) {
  if (source.NODE_ENV === "production") return databaseEnvSchema.parse(source);

  const mode = developmentMongoModeSchema.parse(source.MONGODB_MODE ?? (source.MONGODB_URI ? "custom" : "local"));
  return databaseEnvSchema.parse({ MONGODB_URI: mode === "custom" ? source.MONGODB_URI : developmentMongoUris[mode] });
}
