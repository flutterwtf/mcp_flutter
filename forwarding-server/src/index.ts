#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ClientType, ForwardingServer } from "./forwarding-server.js";

// Function to start the server
export async function startServer() {
  const argv = yargs(hideBin(process.argv))
    .options({
      port: {
        alias: "p",
        description: "Port to run the server on",
        type: "number",
        default: parseInt(process.env.PORT || "8143", 10),
      },
      path: {
        description: "WebSocket path",
        type: "string",
        default: process.env.WS_PATH || "/forward",
      },
    })
    .help()
    .parseSync();

  const server = new ForwardingServer();
  await server.start(argv.port, argv.path);

  // Log client connections and disconnections
  server.on("clientConnected", (clientId: string, clientType: ClientType) => {
    console.log(`Client connected: ${clientId} (${clientType})`);
  });

  server.on(
    "clientDisconnected",
    (clientId: string, clientType: ClientType) => {
      console.log(`Client disconnected: ${clientId} (${clientType})`);
    }
  );

  // Handle graceful shutdown
  const cleanup = async () => {
    console.log("Shutting down...");
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  console.log(
    `Forwarding Server running at ws://localhost:${argv.port}${argv.path}`
  );
}

// Export the main classes for programmatic usage
export { BrowserForwardingClient } from "./browser-client.js";
export { ForwardingClient } from "./client.js";
export { ClientType, ForwardingServer } from "./forwarding-server.js";

// Only start the server if this module is executed directly (not imported)
// This check works in both ES modules and when compiled by TypeScript
const isMainModule =
  import.meta.url.startsWith("file:") &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
