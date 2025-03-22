# Flutter Inspector DevTools Extension

A secure bridge between TypeScript MCP and Flutter applications using DevTools extensions.

## Overview

This DevTools extension provides a secure way to connect to Flutter applications from TypeScript Model Context Protocol (MCP) servers. It acts as an authenticated proxy to the Flutter VM service, enabling tools to inspect and interact with Flutter applications while maintaining security.

## Features

- Secure authentication between TypeScript MCP and Flutter VM service
- Seamless integration with Dart DevTools
- Auto-discovery of Flutter apps running on the machine
- Token-based authentication for secure communication

## Installation

1. Add this package as a dependency in your Flutter project:

```yaml
dev_dependencies:
  dart_proxy: ^1.0.0
```

2. Install the MCP TypeScript server:

```bash
todo
```

## Usage

### In Flutter DevTools

1. Run your Flutter application with DevTools:

```bash
flutter run
```

2. Open DevTools from the URL shown in the console or from your IDE
3. Navigate to the "Flutter Inspector" tab in DevTools
4. Click "Generate Authentication Token" to get a token for MCP

### In TypeScript MCP

1. Verify authentication with the token from DevTools:

```typescript
// Example MCP client code
await client.callTool("mcp_flutter_inspector_verify_devtools_auth", {
  auth_token: "token-from-devtools",
});
```

2. Use the MCP tools to interact with the Flutter app:

```typescript
// Now you can use any of the Flutter tools
const result = await client.callTool(
  "mcp_flutter_inspector_debug_dump_render_tree"
);
```

## Building from Source

### Build the DevTools Extension

```bash
cd dart_proxy
make build_extension
```

### Validate the Extension

```bash
cd dart_proxy
make validate_extension
```

## How It Works

1. The DevTools extension connects to the Flutter VM Service
2. When you generate an authentication token, it's securely stored in the extension
3. The TypeScript MCP server verifies this token before accessing the VM Service
4. This creates a secure channel between MCP and the Flutter app

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
