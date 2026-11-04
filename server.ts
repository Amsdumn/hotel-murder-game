import { createServer } from "node:http";
import nextEnv from "@next/env";
import next from "next";
import { getServerEnv } from "./src/lib/env";
import { createSocketServer } from "./src/server/socket/create-socket-server";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const { PORT, HOSTNAME } = getServerEnv();
const app = next({ dev: process.env.NODE_ENV !== "production", hostname: HOSTNAME, port: PORT, webpack: true });

async function main() {
  await app.prepare();
  const handler = app.getRequestHandler();
  const server = createServer((request, response) => handler(request, response));
  createSocketServer(server);
  server.listen(PORT, HOSTNAME, () => {
    console.log(`Hotel Murder Online ready at http://${HOSTNAME}:${PORT}`);
  });
}

main().catch((error: unknown) => {
  console.error("Unable to start server", error);
  process.exitCode = 1;
});
