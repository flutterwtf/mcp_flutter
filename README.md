# Flutter Inspector MCP Server for AI-Powered Development

[GitHub Repository](https://github.com/Arenukvern/mcp_flutter)

🔍 A powerful Model Context Protocol (MCP) server that connects your Flutter apps with AI coding assistants like Cursor, Claude, and Cline.

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or later)
- A Flutter app running in debug mode
- One of: Cursor, Claude, or Cline AI assistant

### Installation from GitHub

For developers who want to contribute to the project or run the latest version directly from source, follow these steps:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Arenukvern/mcp_flutter
   cd flutter-inspector
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   This command installs all necessary dependencies listed in `package.json`.

3. **Build the project:**

   ```bash
   npm run build
   ```

   This command compiles the TypeScript code and creates the `build` directory with the compiled JavaScript files, including `build/index.js`.

4. **Run the Flutter Inspector server:**
   ```bash
   node build/index.js --stdio
   ```
   This command starts the server in stdio mode. You can also use:
   ```bash
   npx -y . --stdio # if you prefer to use npx, ensure package.json "main" points to build/index.js
   ```

After these steps, you can configure your AI coding assistant to use the Flutter Inspector server. Refer to the "🛠️ Add Flutter Inspector to your AI tool" section for configuration details.

### 1-Minute Setup

1. **Start your Flutter app in debug mode**

! Current workaround for security reasons is to run with `--disable-service-auth-codes`. If you know how to fix this, please let me know!

```bash
flutter run --debug --observatory-port=8181 --enable-vm-service --disable-service-auth-codes
```

2. **Run Flutter Inspector (Global Install)**

   ```bash
   npx flutter-inspector --port=3334
   ```

3. **🛠️ Add Flutter Inspector to your AI tool**

   **Note for Local Development (GitHub Install):**

   If you installed the Flutter Inspector from GitHub and built it locally, you need to adjust the paths in the AI tool configurations to point to your local `build/index.js` file. Refer to the "Installation from GitHub" section for instructions on cloning and building the project.

   #### Cursor Setup

   1. Open Cursor's settings
   2. Go to the Features tab
   3. Under "Model Context Protocol", add the server:
      ```json
      {
        "mcpServers": {
          "flutter-inspector": {
            "command": "node",
            "args": ["/path/to/your/cloned/flutter-inspector/build/index.js"],
            "env": {},
            "disabled": false,
            "autoApprove": []
          }
        }
      }
      ```
   4. Restart Cursor
   5. Open Composer in agent mode
   6. You're ready! Try commands like "analyze my Flutter app's widget tree"

   #### Claude Setup

   1. Add to your Claude configuration file:
      ```json
      {
        "mcpServers": {
          "flutter-inspector": {
            "command": "node",
            "args": ["/path/to/your/cloned/flutter-inspector/build/index.js"],
            "env": {
              "PORT": "3334",
              "LOG_LEVEL": "info"
            },
            "disabled": false
          }
        }
      }
      ```
   2. Restart Claude
   3. The Flutter inspector tools will be automatically available

   #### Cline Setup

   1. Add to your `.cline/config.json`:
      ```json
      {
        "mcpServers": {
          "flutter-inspector": {
            "command": "node",
            "args": ["/path/to/your/cloned/flutter-inspector/build/index.js"],
            "env": {
              "PORT": "3334",
              "LOG_LEVEL": "info"
            },
            "disabled": false
          }
        }
      }
      ```
   2. Restart Cline
   3. The Flutter inspector will be automatically available in your conversations

## 🎯 What You Can Do

- **Analyze Widget Trees**: Get detailed information about your Flutter app's structure
- **Inspect Navigation**: See current routes and navigation state
- **Debug Layout Issues**: Understand widget relationships and properties
- **AI-Powered Assistance**: Get smarter code suggestions based on your app's context

## 🔧 Configuration Options

### Environment Variables (`.env`)

```bash
PORT=3334              # Server port (default: 3334)
LOG_LEVEL=info        # Logging level (error, warn, info, debug)
```

### Command Line Arguments

```bash
--port, -p     # Server port
--stdio        # Run in stdio mode (default: true)
--log-level    # Set logging level
--help         # Show help
```

## 🔍 Troubleshooting

1. **Connection Issues**

   - Ensure your Flutter app is running in debug mode
   - Verify the port matches in both Flutter app and inspector
   - Check if the port is not being used by another process

2. **AI Tool Not Detecting Inspector**
   - Restart the AI tool after configuration changes
   - Verify the configuration JSON syntax
   - Check the tool's logs for connection errors

## 📚 Available Tools

All tools default to using port 8181 if no port is specified. You can override this by providing a specific port number.

- `get_active_ports`: Lists all Flutter/Dart processes listening on ports
- `get_supported_protocols`: Retrieves supported protocols from a Flutter app
- `get_vm_info`: Gets detailed VM information from a running Flutter app
- `get_render_tree`: Fetches the render tree structure from your Flutter app
- `get_layer_tree`: Retrieves the layer tree information for debugging rendering
- `get_semantics_tree`: Gets the semantics tree for accessibility debugging
- `toggle_debug_paint`: Enables/disables debug paint mode in the Flutter app
- `get_flutter_version`: Retrieves Flutter version information
- `stream_listen`: Subscribes to Flutter event streams (Debug, Isolate, VM, GC, Timeline, Logging, Service, HeapSnapshot)

Each tool serves a specific debugging or inspection purpose:

### Core Tools

- `get_active_ports`: Find all Flutter/Dart processes and their ports
- `get_flutter_version`: Check Flutter version and configuration

### Debugging Tools

- `toggle_debug_paint`: Visualize layout bounds and padding
- `get_render_tree`: Analyze widget rendering structure
- `get_layer_tree`: Debug rendering performance issues
- `get_semantics_tree`: Test accessibility implementation

### Advanced Tools

- `get_supported_protocols`: Check available debugging protocols
- `get_vm_info`: Access Dart VM details and metrics
- `stream_listen`: Subscribe to real-time events for:
  - Debug events
  - Isolate lifecycle
  - VM events
  - Garbage collection
  - Timeline events
  - Logging
  - Service events
  - Heap snapshots

2. **Method Not Found Errors**
   - Ensure your Flutter app is running in debug mode
   - Some methods may only be available in certain Flutter versions
   - Check if the method is supported using `get_supported_protocols`

## 🔧 Implementing New RPC Methods

### Step-by-Step Guide

1. **Add RPC Method Definition**

   ```typescript
   // In src/index.ts, add to appropriate group in FlutterRPC
   const FlutterRPC = {
     GroupName: {
       METHOD_NAME: createRPCMethod(RPCPrefix.GROUP, "methodName"),
       // ... other methods
     },
   };
   ```

2. **Add Tool Definition**

   ```typescript
   // In ListToolsRequestSchema handler
   {
     name: "method_name",
     description: "Clear description of what the method does",
     inputSchema: {
       type: "object",
       properties: {
         port: {
           type: "number",
           description: "Port number where the Flutter app is running (defaults to 8181)",
         },
         // Add other parameters if needed
         paramName: {
           type: "string", // or boolean, number, etc.
           description: "Parameter description",
         }
       },
       required: ["paramName"], // List required parameters
     }
   }
   ```

3. **Implement Handler**
   ```typescript
   // In CallToolRequestSchema handler
   case "method_name": {
     const port = handlePortParam();
     // Get and validate parameters if any
     const { paramName } = request.params.arguments as { paramName: string };
     if (!paramName) {
       throw new McpError(
         ErrorCode.InvalidParams,
         "paramName parameter is required"
       );
     }
     // Call the RPC method
     return wrapResponse(
       this.invokeFlutterExtension(port, FlutterRPC.GroupName.METHOD_NAME, {
         paramName,
       })
     );
   }
   ```

### Implementation Checklist

1. **Method Definition**

   - [ ] Add to appropriate group in `FlutterRPC`
   - [ ] Use correct `RPCPrefix`
   - [ ] Follow naming convention

2. **Tool Definition**

   - [ ] Add clear description
   - [ ] Define all parameters
   - [ ] Mark required parameters
   - [ ] Add port parameter
   - [ ] Document parameter types

3. **Handler Implementation**

   - [ ] Add case in switch statement
   - [ ] Handle port parameter
   - [ ] Validate all parameters
   - [ ] Add error handling
   - [ ] Use proper types
   - [ ] Return wrapped response

4. **Testing**
   - [ ] Verify method works in debug mode
   - [ ] Test with different parameter values
   - [ ] Test error cases
   - [ ] Test with default port

### Example Implementation

```typescript
// 1. Add RPC Method
const FlutterRPC = {
  Inspector: {
    GET_WIDGET_DETAILS: createRPCMethod(RPCPrefix.INSPECTOR, "getWidgetDetails"),
  }
};

// 2. Add Tool Definition
{
  name: "get_widget_details",
  description: "Get detailed information about a specific widget",
  inputSchema: {
    type: "object",
    properties: {
      port: {
        type: "number",
        description: "Port number where the Flutter app is running (defaults to 8181)",
      },
      widgetId: {
        type: "string",
        description: "ID of the widget to inspect",
      }
    },
    required: ["widgetId"],
  }
}

// 3. Implement Handler
case "get_widget_details": {
  const port = handlePortParam();
  const { widgetId } = request.params.arguments as { widgetId: string };
  if (!widgetId) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "widgetId parameter is required"
    );
  }
  await this.verifyFlutterDebugMode(port);
  return wrapResponse(
    this.invokeFlutterExtension(port, FlutterRPC.Inspector.GET_WIDGET_DETAILS, {
      widgetId,
    })
  );
}
```

### Common Patterns

1. **Parameter Validation**

   - Always validate required parameters
   - Use TypeScript types for type safety
   - Throw `McpError` with clear messages

2. **Error Handling**

   - Use try-catch blocks for async operations
   - Verify Flutter debug mode when needed
   - Handle connection errors

3. **Response Wrapping**

   - Use `wrapResponse` for consistent formatting
   - Handle both success and error cases
   - Format response data appropriately

4. **Port Handling**
   - Use `handlePortParam()` for port management
   - Default to 8181 if not specified
   - Validate port number

### Notes for AI Agents

When implementing methods from todo.yaml:

1. Follow the step-by-step guide above
2. Use the example implementation as a template
3. Ensure all checklist items are completed
4. Add proper error handling and parameter validation
5. Follow the common patterns section
6. Test the implementation thoroughly

For each new method:

1. Check the method's group (UI, DartIO, Inspector, etc.)
2. Determine required parameters from method name and context
3. Implement following the standard patterns
4. Add appropriate error handling
5. Follow the existing code style

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or report issues on the [GitHub repository](https://github.com/Arenukvern/mcp_flutter).

## 📖 Learn More

- [Flutter DevTools Documentation](https://docs.flutter.dev/development/tools/devtools/overview)
- [Dart VM Service Protocol](https://github.com/dart-lang/sdk/blob/main/runtime/vm/service/service.md)
- [Flutter DevTools RPC Constants (I guess and hope they are correct:))](https://github.com/flutter/devtools/tree/87f8016e2610c98c3e2eae8b1c823de068701dfd/packages/devtools_app/lib/src/shared/analytics/constants)

## 📄 License

MIT - Feel free to use in your projects!

---

_Flutter and Dart are trademarks of Google LLC._
