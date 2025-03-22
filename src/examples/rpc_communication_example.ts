import { CommandLineArgs } from "../index.js";
import { FlutterInspectorServer } from "../servers/flutter_inspector_server.js";

/**
 * Example showing how to use the Flutter Inspector's RPC server
 * to communicate with Dart/Flutter web clients
 */
async function main() {
  // Mock the environment variables
  process.env.PORT = "8142"; // Port for the web client RPC server
  process.env.LOG_LEVEL = "info";
  process.env.HOST = "localhost";

  // Use the static factory method to create CommandLineArgs
  // This is the correct way to instantiate it since the constructor is private
  const args = CommandLineArgs.fromCommandLine();

  // Initialize the Flutter Inspector server with properly created args
  const server = new FlutterInspectorServer(args);

  // Start the server (this will initialize the RPC server automatically)
  await server.run();

  console.log("Server is running. Waiting for dart client connections...");

  // Set up periodic status check for connected clients
  setInterval(async () => {
    const connectedClients = server.getConnectedDartClients();

    if (connectedClients.length > 0) {
      console.log(`Connected clients: ${connectedClients.length}`);

      // Broadcast a heartbeat to all connected clients
      try {
        const results = await server.broadcastToDartClients("heartbeat", {
          timestamp: Date.now(),
          message: "Server is alive",
        });

        console.log("Heartbeat results:", results);
      } catch (error) {
        console.error("Failed to broadcast heartbeat:", error);
      }
    }
  }, 5000); // Check every 5 seconds
}

// Handle errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// Run the example
main().catch(console.error);
