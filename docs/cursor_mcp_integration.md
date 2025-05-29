# Flutter Inspector MCP Server - Cursor Integration Guide

This guide explains how to integrate the Flutter Inspector MCP Server with Cursor IDE using the Model Context Protocol (MCP).

## Overview

The Flutter Inspector MCP Server provides real-time debugging and inspection capabilities for Flutter applications directly within Cursor IDE. It offers tools for hot reloading, VM inspection, extension management, and visual debugging resources.

## Prerequisites

- Cursor IDE with MCP support
- Dart SDK installed
- Flutter SDK installed
- A Flutter project in debug mode

## Installation Methods

### Method 1: Using Executable Binary (@bin)

#### 1. Build the Executable

```bash
cd mcp_server_dart
dart compile exe bin/main.dart -o flutter_inspector_mcp
```

#### 2. Configure Cursor MCP Settings

Add to your Cursor MCP configuration file (usually `~/.cursor/mcp_servers.json` or project-specific `.cursor/mcp_servers.json`):

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "/absolute/path/to/flutter_inspector_mcp",
      "args": [
        "--dart-vm-host=localhost",
        "--dart-vm-port=8181",
        "--resources-supported",
        "--images-supported"
      ],
      "env": {}
    }
  }
}
```

#### 3. Alternative: Global Installation

```bash
# Install globally
dart pub global activate --source path mcp_server_dart

# Configure with global path
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "flutter_inspector_mcp",
      "args": ["--dart-vm-host=localhost", "--dart-vm-port=8181"]
    }
  }
}
```

### Method 2: Using Dart Script (@lib)

#### 1. Configure Direct Dart Execution

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "dart",
      "args": [
        "run",
        "/absolute/path/to/mcp_server_dart/bin/main.dart",
        "--dart-vm-host=localhost",
        "--dart-vm-port=8181",
        "--resources-supported",
        "--images-supported"
      ],
      "env": {
        "DART_SDK": "/path/to/dart-sdk"
      }
    }
  }
}
```

#### 2. Using Package Reference

If published as a package:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "dart",
      "args": [
        "run",
        "flutter_inspector_mcp_server",
        "--dart-vm-host=localhost",
        "--dart-vm-port=8181"
      ]
    }
  }
}
```

## Configuration Options

### Command Line Arguments

| Argument                | Default     | Description                                              |
| ----------------------- | ----------- | -------------------------------------------------------- |
| `--dart-vm-host`        | `localhost` | Host for Dart VM connection                              |
| `--dart-vm-port`        | `8181`      | Port for Dart VM connection                              |
| `--resources-supported` | `true`      | Enable resources support for widget tree and screenshots |
| `--images-supported`    | `true`      | Enable images support for screenshots                    |
| `--help`                | -           | Show usage information                                   |

### Environment Variables

```bash
export DART_VM_HOST=localhost
export DART_VM_PORT=8181
export FLUTTER_INSPECTOR_RESOURCES=true
export FLUTTER_INSPECTOR_IMAGES=true
```

## Available Tools

Once configured, the following tools become available in Cursor:

### 1. Hot Reload Flutter

```typescript
// Hot reload the Flutter app
mcp_flutter -
  inspector_hot_reload_flutter({
    force: boolean,
    port: number,
  });
```

### 2. Get VM Information

```typescript
// Get VM information from Flutter app
mcp_flutter -
  inspector_get_vm({
    port: number,
  });
```

### 3. Get Extension RPCs

```typescript
// List all available extension RPCs
mcp_flutter -
  inspector_get_extension_rpcs({
    port: number,
    isolateId: string,
    isRawResponse: boolean,
  });
```

### 4. Test Custom Extension

```typescript
// Test the custom extension
mcp_flutter -
  inspector_test_custom_ext({
    port: number,
  });
```

## Available Resources

### 1. Application Errors

- **URI**: `visual://localhost/app/errors/latest`
- **Description**: Get the most recent application errors
- **Format**: JSON with error details and stack traces

### 2. View Screenshots

- **URI**: `visual://localhost/view/screenshots`
- **Description**: Get screenshots of all views
- **Format**: Base64 encoded PNG images
- **Requirement**: `--images-supported` flag

### 3. View Details

- **URI**: `visual://localhost/view/details`
- **Description**: Get detailed information about all views
- **Format**: JSON with view hierarchy and properties

## Usage Workflow

### 1. Start Your Flutter App in Debug Mode

```bash
cd your_flutter_project
flutter run --debug
```

### 2. Verify Connection

The Flutter app should be running on `localhost:8181` (default debug port).

### 3. Use in Cursor

Once configured, you can:

- Ask Cursor to hot reload your Flutter app
- Request VM information and debugging details
- Get screenshots and visual debugging information
- Access real-time error information

### Example Cursor Prompts

```
"Hot reload my Flutter app"
"Show me the current VM information"
"Get a screenshot of my app"
"What are the latest errors in my Flutter app?"
"List all available extension RPCs"
```

## Troubleshooting

### Common Issues

#### 1. Connection Failed

```
Error: Failed to connect to VM service at localhost:8181
```

**Solutions:**

- Ensure Flutter app is running in debug mode
- Check if port 8181 is available
- Verify VM service is enabled: `flutter run --debug --enable-vm-service`

#### 2. Permission Denied

```
Error: Permission denied executing flutter_inspector_mcp
```

**Solutions:**

```bash
chmod +x flutter_inspector_mcp
```

#### 3. Dart Not Found

```
Error: dart: command not found
```

**Solutions:**

- Add Dart SDK to PATH
- Use absolute path to dart executable
- Set DART_SDK environment variable

### Debug Mode

Enable verbose logging by setting environment variables:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "dart",
      "args": ["run", "bin/main.dart", "--dart-vm-port=8181"],
      "env": {
        "FLUTTER_INSPECTOR_DEBUG": "true",
        "DART_VM_DEBUG": "true"
      }
    }
  }
}
```

## Advanced Configuration

### Custom Port Configuration

For multiple Flutter apps or custom ports:

```json
{
  "mcpServers": {
    "flutter-inspector-main": {
      "command": "flutter_inspector_mcp",
      "args": ["--dart-vm-port=8181"]
    },
    "flutter-inspector-test": {
      "command": "flutter_inspector_mcp",
      "args": ["--dart-vm-port=8182"]
    }
  }
}
```

### Resource-Only Mode

Disable tools and only use resources:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "flutter_inspector_mcp",
      "args": [
        "--dart-vm-port=8181",
        "--resources-supported",
        "--no-images-supported"
      ]
    }
  }
}
```

## Security Considerations

- The MCP server connects to localhost by default
- VM service should only be enabled in debug mode
- Consider firewall rules for custom host configurations
- Avoid exposing VM service ports in production

## Performance Tips

- Use `--no-images-supported` if screenshots aren't needed
- Limit resource polling frequency
- Consider using specific isolate IDs for better performance
- Monitor memory usage with multiple MCP connections

## Integration Examples

### VS Code Settings (for reference)

```json
{
  "mcp.servers": {
    "flutter-inspector": {
      "command": "dart",
      "args": ["run", "flutter_inspector_mcp_server"],
      "initializationOptions": {
        "dartVMHost": "localhost",
        "dartVMPort": 8181
      }
    }
  }
}
```

### Project-Specific Configuration

Create `.cursor/mcp_servers.json` in your Flutter project:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "dart",
      "args": [
        "run",
        "../mcp_server_dart/bin/main.dart",
        "--dart-vm-port=8181"
      ],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

## Next Steps

1. **Test the Integration**: Start with basic hot reload functionality
2. **Explore Resources**: Use visual debugging features
3. **Custom Extensions**: Extend the server for project-specific needs
4. **Performance Monitoring**: Monitor resource usage and optimize
5. **Team Setup**: Share configuration across development team

## Support

For issues and contributions:

- Check the project repository for latest updates
- Report bugs with detailed connection logs
- Contribute improvements to the MCP server implementation

---

_This documentation covers the integration of Flutter Inspector MCP Server with Cursor IDE. For the latest updates and advanced features, refer to the project repository._
