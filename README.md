# Flutter Inspector MCP Server for AI-Powered Development

[GitHub Repository](https://github.com/Arenukvern/mcp_flutter)
[![smithery badge](https://smithery.ai/badge/@Arenukvern/mcp_flutter)](https://smithery.ai/server/@Arenukvern/mcp_flutter)

🔍 A powerful Model Context Protocol (MCP) server that connects your Flutter apps with AI coding assistants like Cursor, Claude, and Cline.

<a href="https://glama.ai/mcp/servers/qnu3f0fa20">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/qnu3f0fa20/badge" alt="Flutter Inspector Server MCP server" />
</a>

⚠️ This project is a work in progress and not all methods (mostly Flutter Inspector related) are implemented yet.

Currently Flutter works with MCP server via forwarding server. Please see [Architecture](https://github.com/Arenukvern/mcp_flutter/blob/main/ARCHITECTURE.md) for more details.

Some of other methods are not tested - they may work or not. Please use with caution. It is possible that the most methods will be removed from the MCP server later to focus solely on Flutter applications and maybe Jaspr.

# ⚠️ WARNING ⚠️

Debug methods, which may use huge amount of tokens and therefore overload context now placed under "debug-tools" parameter. In production, any debug methods are disabled by default.

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or later)
- A Flutter app running in debug mode
- One of: Cursor, Claude, or Cline AI assistant

### Installing via Smithery (WIP)

To install Flutter Inspector for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@Arenukvern/mcp_flutter):

```bash
npx -y @smithery/cli install @Arenukvern/mcp_flutter --client claude
```

### Installation from GitHub (Currently Recommended)

For developers who want to contribute to the project or run the latest version directly from source, follow these steps:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Arenukvern/mcp_flutter
   cd flutter-inspector
   ```

2. **Install and build dependencies:**

   ```bash
   make install
   ```

   This command installs all necessary dependencies listed in `package.json` and then builds MCP server and forwarding server.

3. **Start forwarding server:**

   ```bash
   make forward
   ```

4. **Add DevTools Flutter Extension to Flutter App:**

   ```bash
   flutter pub add --dev devtools_mcp_extension
   ```

5. **Start your Flutter app in debug mode**

   ! Current workaround for security reasons is to run with `--disable-service-auth-codes`. If you know how to fix this, please let me know!

   ```bash
   flutter run --debug --observatory-port=8181 --enable-vm-service --disable-service-auth-codes
   ```

6. **🛠️ Add Flutter Inspector to your AI tool**

   **Note for Local Development (GitHub Install):**

   If you installed the Flutter Inspector from GitHub and built it locally, you need to adjust the paths in the AI tool configurations to point to your local `build/index.js` file. Refer to the "Installation from GitHub" section for instructions on cloning and building the project.

   #### Cline Setup

   1. Add to your `.cline/config.json`:
      ```json
      {
        "mcpServers": {
          "flutter-inspector": {
            "command": "node",
            "args": [
              "/path/to/your/cloned/flutter-inspector/mcp_server/build/index.js"
            ],
            "env": {
              "PORT": "3334",
              "LOG_LEVEL": "critical"
            },
            "disabled": false
          }
        }
      }
      ```
   2. Restart Cline
   3. The Flutter inspector will be automatically available in your conversations

   #### Cursor Setup

   # ⚠️ Resources Limitations ⚠️

   - Since Cursor doesn't support resources, make sure you passed `RESOURCES_SUPPORTED=false` as environment variable. It will make some resources to be displayed as tools.

   1. Open Cursor's settings
   2. Go to the Features tab
   3. Under "Model Context Protocol", add the server:
      ```json
      {
        "mcpServers": {
          "flutter-inspector": {
            "command": "node",
            "args": [
              "/path/to/your/cloned/flutter-inspector/mcp_server/build/index.js"
            ],
            "env": {
              "RESOURCES_SUPPORTED": false
            },
            "disabled": false,
            "autoApprove": []
          }
        }
      }
      ```
   4. Restart Cursor
   5. Open Agent Panel (cmd + L on macOS)
   6. You're ready! Try commands like "analyze my Flutter app's widget tree"

   #### Claude Setup

   1. Add to your Claude configuration file:
      ```json
      {
        "mcpServers": {
          "flutter-inspector": {
            "command": "node",
            "args": [
              "/path/to/your/cloned/flutter-inspector/mcp_server/build/index.js"
            ],
            "env": {
              "PORT": "3334",
              "LOG_LEVEL": "critical"
            },
            "disabled": false
          }
        }
      }
      ```
   2. Restart Claude
   3. The Flutter inspector tools will be automatically available

## 🔧 Configuration Options

### Environment Variables (`.env`)

```bash
# will be used for direct connections to the dart vm
DART_VM_PORT=8181
DART_VM_HOST=localhost

# will be used for this MCP server
MCP_SERVER_PORT=3535
MCP_SERVER_HOST=localhost

# will be used for the forwarding server
FORWARDING_SERVER_PORT=8143
FORWARDING_SERVER_HOST=localhost

# Logging configuration
LOG_LEVEL=critical

# Development configuration
NODE_ENV=development

# Resources configuration
RESOURCES_SUPPORTED=true
```

### Command Line Arguments

```bash
--port, -p     # Server port
--stdio        # Run in stdio mode (default: true)
--resources    # Enable resources support (default: true)
--log-level    # Set logging level (debug, info, notice, warning, error, critical, alert, emergency) according to https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging/#log-levels
--help         # Show help
```

## Port Configuration

All Flutter Inspector tools automatically connect to the default Flutter debug port (8181). You only need to specify a port if:

- You're running Flutter on a different port
- You have multiple Flutter instances running
- You've configured a custom debug port

Example usage:

```json
// Default port (8181)
{
  "name": "debug_dump_render_tree"
}

// Custom port
{
  "name": "debug_dump_render_tree",
  "arguments": {
    "port": 8182
  }
}
```

## 🔧 Troubleshooting

Make sure you:

1. Verify that forwarding server is running.
2. Opened Devtools in Browser.
3. Have added MCP extension to your Flutter app dev dependencies and enabled it in Devtools.

4. **Connection Issues**

   - Ensure your Flutter app is running in debug mode
   - Verify the port matches in both Flutter app and inspector
   - Check if the port is not being used by another process

5. **AI Tool Not Detecting Inspector**
   - Restart the AI tool after configuration changes
   - Verify the configuration JSON syntax
   - Check the tool's logs for connection errors

## 🎯 What You Can Hopefully Do

- **Analyze Widget Trees**: Get detailed information about your Flutter app's structure
- **Inspect Navigation**: See current routes and navigation state
- **Debug Layout Issues**: Understand widget relationships and properties

## 📚 Available Tools

All tools default to using port 8181 if no port is specified. You can override this by providing a specific port number.

### Utility Methods - Direct RPC Dart VM Calls

These are helper methods that provide additional functionality beyond direct Flutter RPC calls:

- `get_active_ports`: Lists all Flutter/Dart processes listening on ports
- `get_supported_protocols`: Retrieves supported protocols from a Flutter app
- `get_vm_info`: Gets detailed VM information from a running Flutter app
- `get_extension_rpcs`: Lists all available extension RPCs in the Flutter app

### Debug Methods (ext.flutter.debug\*) - Direct RPC Dart VM Calls

Direct RPC methods for debugging Flutter applications:

- `debug_dump_render_tree`: Dumps the render tree structure
- `debug_dump_layer_tree`: Dumps the layer tree for rendering analysis
- `debug_dump_semantics_tree`: Dumps the semantics tree for accessibility analysis
- `debug_paint_baselines_enabled`: Toggles baseline paint debugging
- `debug_dump_focus_tree`: Dumps the focus tree for input handling analysis

### Inspector Methods (ext.flutter.inspector.\*) - Via Flutter Devtools Extension

Direct RPC methods for inspecting Flutter widget trees and layout:

- `inspector_screenshot`: Takes a screenshot of the Flutter app
<!-- - `inspector_get_layout_explorer_node`: Gets layout information for a specific widget -->

### DartIO Methods (ext.dart.io.\*)

Direct RPC methods for Dart I/O operations:

- `dart_io_get_version`: Gets Flutter version information

### Method Categories

1. **Direct RPC Methods**
   These methods map directly to Flutter's extension RPCs:

   - All methods prefixed with `debug_`, `inspector_`, or `dart_io_`
   - Each method corresponds to a specific Flutter RPC endpoint
   - Parameters and return values match Flutter's specifications

2. **Utility Methods**
   These are helper methods that provide additional functionality:

   - Process discovery (`get_active_ports`)
   - Protocol inspection (`get_supported_protocols`)
   - VM interaction (`get_vm_info`)
   - RPC discovery (`get_extension_rpcs`)

## Smithery Integration

The Flutter Inspector is registered with Smithery's registry, making it discoverable and usable by other AI tools through a standardized interface.

### Integration Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────┐
│                 │     │              │     │              │     │                 │     │             │
│  Flutter App    │<--->│  DevTools    │<--->│  Forwarding  │<--->│   MCP Server   │<--->│  Smithery   │
│  (Debug Mode)   │     │  Extension   │     │  Server      │     │   (Registered) │     │  Registry   │
│                 │     │              │     │              │     │                 │     │             │
└─────────────────┘     └──────────────┘     └──────────────┘     └─────────────────┘     └─────────────┘
```

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
