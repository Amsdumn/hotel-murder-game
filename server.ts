import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import nextEnv from "@next/env";
import next from "next";
import { getServerEnv } from "./src/lib/env";
import { getServerUrls } from "./src/lib/server-urls";
import { createSocketServer } from "./src/server/socket/create-socket-server";
import { prepareAccessGateEnvironment } from "./src/server/access-gate";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const { PORT, BIND_HOST } = getServerEnv();
const generatedAccessPassword = prepareAccessGateEnvironment();
const app = next({ dev: process.env.NODE_ENV !== "production", hostname: BIND_HOST, port: PORT, webpack: true });

async function main() {
  await app.prepare();
  const handler = app.getRequestHandler();
  const server = createServer((request, response) => handler(request, response));
  createSocketServer(server);
  server.listen(PORT, BIND_HOST, () => {
    const address = server.address();
    if (!address || typeof address === "string") return;
    const urls = getServerUrls(address.address, address.port, networkInterfaces());
    console.log(`Hotel Murder Online listening on ${address.address}:${address.port}`);
    if (generatedAccessPassword) console.log(`Development access password: ${generatedAccessPassword}`);
    for (const [index, url] of urls.entries()) {
      console.log(`${index === 0 ? "Local" : "Network"}: ${url}`);
    }
  });
}

main().catch((error: unknown) => {
  console.error("Unable to start server", error);
  process.exitCode = 1;
});
