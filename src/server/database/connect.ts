import mongoose from "mongoose";
import { getDatabaseEnv } from "@/lib/env";

let pendingConnection: Promise<typeof mongoose> | null = null;

export function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!pendingConnection) {
    const { MONGODB_URI } = getDatabaseEnv();
    pendingConnection = mongoose.connect(MONGODB_URI).finally(() => {
      pendingConnection = null;
    });
  }
  return pendingConnection;
}
