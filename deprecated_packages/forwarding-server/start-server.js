#!/usr/bin/env node

// This is a simple wrapper to start the forwarding server
// It can be used directly with Node.js: node start-server.js

import { startServer } from "./dist/index.js";

console.log("Starting Forwarding Server...");

// Add lots of debugging
process.env.DEBUG = "ws,engine,socket.io,socket.io:*";

// Start the server
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
