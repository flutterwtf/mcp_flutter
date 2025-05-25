# Dynamic Tool/Resource Registration System

## Overview

This document describes the implementation of a dynamic tool and resource registration system for the Flutter MCP (Model Context Protocol) project. This system allows Flutter applications to self-register their capabilities with the MCP server at runtime, eliminating the need for static YAML configuration files.

## Architecture

### Before (Static System)

```
AI Assistant → MCP Server (static YAML tools) → Dart VM Service → Flutter App
```

### After (Dynamic System)

```
AI Assistant → MCP Server (static + dynamic tools) → Dart VM Service → Flutter App
                    ↑
Flutter App (MCP Client) ←→ MCP Server (dynamic registration)
```

## Key Components

### 1. MCP Server Components

#### DynamicToolRegistry (`mcp_server/src/services/dynamic_registry/dynamic_tool_registry.ts`)

- **Purpose**: Manages runtime registration of tools and resources
- **Features**:
  - In-memory storage of dynamic registrations
  - App connection tracking by Dart VM port
  - Automatic cleanup when apps disconnect
  - Port change detection and re-registration

#### New MCP Tools

- **`installTool`**: Register a new tool from Flutter app
- **`installResource`**: Register a new resource from Flutter app
- **`listDynamicRegistrations`**: List all dynamic registrations

#### Enhanced ToolsHandlers (`mcp_server/src/tools/tools_handlers.ts`)

- **Dynamic Tool Routing**: Routes calls to appropriate Flutter app based on registration
- **Combined Tool Lists**: Merges static YAML tools with dynamic registrations
- **Error Handling**: Graceful handling of disconnected apps

### 2. Flutter Components

#### MCPClientService (`mcp_toolkit/mcp_toolkit/lib/src/services/mcp_client_service.dart`)

- **Purpose**: HTTP client for communicating with MCP server
- **Features**:
  - Tool and resource registration
  - Automatic app ID generation
  - Dart VM port detection
  - Batch registration support

#### Enhanced MCPToolkitBinding (`mcp_toolkit/mcp_toolkit/lib/src/mcp_toolkit_binding.dart`)

- **Auto-Discovery**: Automatically registers service extensions with MCP server
- **Custom Registration**: Manual registration of additional tools/resources
- **Configuration**: Configurable MCP server connection settings

## Implementation Details

### Registration Flow

1. **Flutter App Startup**:

   ```dart
   MCPToolkitBinding.instance
     ..initialize(enableAutoDiscovery: true)
     ..initializeFlutterToolkit();
   ```

2. **Auto-Registration**:

   - Service extensions are converted to `MCPToolDefinition`
   - HTTP request sent to MCP server's `installTool` endpoint
   - MCP server stores registration in `DynamicToolRegistry`

3. **Tool Execution**:
   - AI assistant calls tool via MCP server
   - MCP server routes to appropriate Flutter app using stored port
   - Result returned through standard MCP response format

### Port Change Handling

When a Flutter app restarts on a different port:

1. MCP server detects port change in registration request
2. Previous registrations for that app are removed
3. New registrations are stored with updated port
4. No manual cleanup required

### Error Handling

- **Connection Failures**: Graceful degradation, tools remain available
- **App Disconnection**: Automatic cleanup of registrations
- **Invalid Registrations**: Validation with clear error messages
- **Tool Execution Errors**: Proper MCP error responses

## Usage Examples

### Basic Setup

```dart
import 'package:flutter/material.dart';
import 'package:mcp_toolkit/mcp_toolkit.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  MCPToolkitBinding.instance
    ..initialize(
      enableAutoDiscovery: true,
      mcpServerConfig: const MCPServerConfig(
        host: 'localhost',
        port: 3535,
      ),
    )
    ..initializeFlutterToolkit();

  runApp(MyApp());
}
```

### Custom Tool Registration

```dart
// Register a custom calculation tool
await MCPToolkitBinding.instance.registerCustomTool(
  const MCPToolDefinition(
    name: 'calculate_fibonacci',
    description: 'Calculate the nth Fibonacci number',
    inputSchema: {
      'type': 'object',
      'properties': {
        'n': {
          'type': 'integer',
          'description': 'The position in the Fibonacci sequence',
          'minimum': 0,
          'maximum': 100,
        },
      },
      'required': ['n'],
    },
  ),
);
```

### Custom Resource Registration

```dart
// Register app state as a resource
await MCPToolkitBinding.instance.registerCustomResource(
  const MCPResourceDefinition(
    uri: 'flutter://app/state',
    name: 'App State',
    description: 'Current application state and configuration',
    mimeType: 'application/json',
  ),
);
```

## Configuration

### MCP Server Configuration

The MCP server accepts dynamic registrations through HTTP endpoints:

```typescript
// Default configuration
const config = {
  host: "localhost",
  port: 3535,
  protocol: "http",
};
```

### Flutter App Configuration

```dart
const mcpConfig = MCPServerConfig(
  host: 'localhost',    // MCP server host
  port: 3535,          // MCP server port
  protocol: 'http',    // Protocol (http/https)
);
```

## Benefits

### For Developers

- **No Static Configuration**: Tools are registered automatically
- **Hot Reload Support**: Changes reflected immediately
- **Type Safety**: Strong typing for tool definitions
- **Error Handling**: Clear error messages and graceful degradation

### For AI Assistants

- **Dynamic Discovery**: New tools available immediately
- **Rich Metadata**: Detailed tool descriptions and schemas
- **Reliable Routing**: Automatic routing to correct app instance
- **Consistent Interface**: Standard MCP protocol compliance

### For System Architecture

- **Scalability**: Support for multiple Flutter apps
- **Maintainability**: No manual YAML file management
- **Flexibility**: Runtime tool registration and modification
- **Robustness**: Automatic cleanup and error recovery

## Migration Guide

### From Static to Dynamic

1. **Update MCP Server**:

   - Add `DynamicToolRegistry` to server initialization
   - Update `ToolsHandlers` to include dynamic registry
   - Deploy updated server

2. **Update Flutter Apps**:

   - Add `mcp_toolkit` dependency
   - Initialize with `enableAutoDiscovery: true`
   - Remove manual tool configuration

3. **Verify Registration**:
   - Use `listDynamicRegistrations` tool to verify
   - Check server logs for registration events
   - Test tool execution through AI assistant

## Troubleshooting

### Common Issues

1. **Tools Not Appearing**:

   - Check MCP server connectivity
   - Verify `enableAutoDiscovery: true`
   - Check server logs for registration errors

2. **Tool Execution Failures**:

   - Verify Dart VM port accessibility
   - Check service extension registration
   - Review error logs in both server and app

3. **Port Conflicts**:
   - Ensure unique Dart VM ports per app
   - Check for port binding conflicts
   - Verify firewall settings

### Debug Commands

```bash
# Check MCP server status
curl http://localhost:3535/health

# List dynamic registrations
curl -X POST http://localhost:3535/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"listDynamicRegistrations"}}'
```

## Future Enhancements

### Planned Features

- **WebSocket Support**: Real-time registration updates
- **Tool Versioning**: Support for tool version management
- **Resource Streaming**: Dynamic resource content updates
- **Authentication**: Secure registration with API keys
- **Clustering**: Multi-server registration synchronization

### Extension Points

- **Custom Protocols**: Support for additional transport protocols
- **Plugin System**: Extensible registration handlers
- **Monitoring**: Registration analytics and health monitoring
- **Caching**: Intelligent caching of tool metadata

## Conclusion

The dynamic registration system transforms the Flutter MCP architecture from a static, configuration-driven approach to a dynamic, self-discovering system. This enables:

- **Faster Development**: No manual configuration required
- **Better Reliability**: Automatic cleanup and error handling
- **Enhanced Scalability**: Support for multiple concurrent apps
- **Improved Developer Experience**: Type-safe, intuitive API

The system maintains full backward compatibility while providing a foundation for future enhancements and extensibility.
