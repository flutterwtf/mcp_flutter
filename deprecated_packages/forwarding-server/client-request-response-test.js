#!/usr/bin/env node

/**
 * This script tests the request-response pattern between Flutter and Inspector clients
 * It starts two clients (one Flutter, one Inspector) and sends messages between them
 */

import { ForwardingClient } from "./dist/client.js";
import { ClientType } from "./dist/forwarding-server.js";

// Config
const SERVER_HOST = "localhost";
const SERVER_PORT = 8143;
const SERVER_PATH = "/forward";

// Create clients
const flutterClient = new ForwardingClient(
  ClientType.FLUTTER,
  "test-flutter-client"
);
const inspectorClient = new ForwardingClient(
  ClientType.INSPECTOR,
  "test-inspector-client"
);

// Setup event listeners for Flutter client
flutterClient.on("connected", () => {
  console.log("Flutter client connected");
});

flutterClient.on("message", (message) => {
  console.log(
    "Flutter client received message:",
    JSON.stringify(message, null, 2)
  );
});

// Register a method handler for Flutter client
flutterClient.registerMethod("flutter.test", async (params) => {
  console.log("Flutter client handling test method with params:", params);
  return {
    success: true,
    message: "Flutter client processed test method",
    receivedParams: params,
  };
});

// Setup event listeners for Inspector client
inspectorClient.on("connected", () => {
  console.log("Inspector client connected");
});

inspectorClient.on("message", (message) => {
  console.log(
    "Inspector client received message:",
    JSON.stringify(message, null, 2)
  );
});

// Register a method handler for Inspector client
inspectorClient.registerMethod("inspector.test", async (params) => {
  console.log("Inspector client handling test method with params:", params);
  return {
    success: true,
    message: "Inspector client processed test method",
    receivedParams: params,
  };
});

// Connect both clients
async function startTest() {
  try {
    console.log("Connecting Flutter client...");
    await flutterClient.connect(SERVER_HOST, SERVER_PORT, SERVER_PATH);

    console.log("Connecting Inspector client...");
    await inspectorClient.connect(SERVER_HOST, SERVER_PORT, SERVER_PATH);

    console.log("Both clients connected. Starting tests...");

    // Wait a bit for connections to stabilize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 1: Inspector calls a method on Flutter
    console.log("\n----- TEST 1: Inspector -> Flutter -----");
    console.log("Inspector client calling flutter.test method...");
    const flutterResult = await inspectorClient.callMethod("flutter.test", {
      message: "Hello from Inspector",
      timestamp: Date.now(),
    });
    console.log("Inspector received response from Flutter:", flutterResult);

    // Wait between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 2: Flutter calls a method on Inspector
    console.log("\n----- TEST 2: Flutter -> Inspector -----");
    console.log("Flutter client calling inspector.test method...");
    const inspectorResult = await flutterClient.callMethod("inspector.test", {
      message: "Hello from Flutter",
      timestamp: Date.now(),
    });
    console.log("Flutter received response from Inspector:", inspectorResult);

    console.log("\nTests completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Start the test
startTest()
  .then(() => {
    console.log("Test sequence completed");

    // Keep the process running for a bit to handle any pending messages
    setTimeout(() => {
      console.log("Closing clients...");
      flutterClient.disconnect();
      inspectorClient.disconnect();
      process.exit(0);
    }, 3000);
  })
  .catch((error) => {
    console.error("Error running tests:", error);
    process.exit(1);
  });
