#!/usr/bin/env node

import WebSocket from "ws";

// Configuration
const serverHost = "localhost";
const serverPort = 8143;
const serverPath = "/forward";
const clientType = "inspector"; // This must match the ClientType.INSPECTOR in the server
const clientId = "test-inspector-client-" + Date.now();

// Create WebSocket URL with required parameters
const wsUrl = `ws://${serverHost}:${serverPort}${serverPath}?clientType=${clientType}&clientId=${clientId}`;

console.log(`Connecting to server at ${wsUrl}`);

// Create WebSocket connection
const ws = new WebSocket(wsUrl);

// Connection opened
ws.on("open", () => {
  console.log("Connected to forwarding server");

  // Send a test message
  const testMessage = {
    id: `test-${Date.now()}`,
    method: "inspector.testMethod",
    params: {
      testParam: "Hello from Inspector test client",
    },
    jsonrpc: "2.0",
  };

  console.log("Sending test message:", JSON.stringify(testMessage));
  ws.send(JSON.stringify(testMessage));

  // Send periodic messages to simulate activity
  setInterval(() => {
    const pingMessage = {
      id: `ping-${Date.now()}`,
      method: "inspector.ping",
      params: {
        timestamp: Date.now(),
      },
      jsonrpc: "2.0",
    };
    console.log("Sending ping message");
    ws.send(JSON.stringify(pingMessage));
  }, 5000);
});

// Listen for messages
ws.on("message", (data) => {
  try {
    const message = JSON.parse(data);
    console.log(
      "Received message:",
      JSON.stringify(message).substring(0, 200) +
        (JSON.stringify(message).length > 200 ? "..." : "")
    );

    // If this is a method call, respond with a result
    if (message.method && message.id) {
      const response = {
        id: message.id,
        result: {
          status: "success",
          message: `Inspector client processed ${message.method}`,
        },
        jsonrpc: "2.0",
      };
      console.log("Sending response:", JSON.stringify(response));
      ws.send(JSON.stringify(response));
    }
  } catch (error) {
    console.error("Error processing received message:", error);
  }
});

// Handle errors and closure
ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});

ws.on("close", (code, reason) => {
  console.log(`Connection closed. Code: ${code}, Reason: ${reason || "none"}`);
  process.exit(0);
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("Closing connection...");
  ws.close();
  setTimeout(() => process.exit(0), 500);
});

console.log("Test Inspector client running. Press Ctrl+C to stop.");
