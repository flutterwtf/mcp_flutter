# LLM Installation Guide: MCP Flutter Inspector

## Overview

This guide provides step-by-step instructions for AI agents to install and configure the MCP Flutter Inspector server by cloning from GitHub. This tool enables AI assistants to inspect and interact with Flutter applications during development.

## Prerequisites

Before starting the installation, ensure the following requirements are met:

- **Node.js**: Version 14 or later
- **Flutter SDK**: Installed and configured
- **Flutter App**: Running in debug mode
- **AI Assistant**: Cursor, Claude, Cline AI, Windsurf, RooCode, or any MCP-compatible tool
- **Git**: For cloning the repository

## Installation Steps

### 1. Clone the Repository into folder with mcp servers

```bash
git clone https://github.com/Arenukvern/mcp_flutter
cd mcp_flutter
```

### 2. Install and Build Dependencies

```bash
make install
```

This command will:

- Install all necessary Node.js dependencies from `package.json`
- Build the MCP server automatically

### 3. Add MCP Toolkit to Your Flutter App

Navigate to your Flutter application directory and add the `mcp_toolkit` package:

```bash
cd /path/to/your/flutter/app
flutter pub add mcp_toolkit
```

Alternatively, manually add to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  # ... other dependencies
  mcp_toolkit: ^0.1.2
```

Then run:

```bash
flutter pub get
```

### 4. Initialize MCP Toolkit in Your Flutter App

Update your Flutter app's `main.dart` file:

```dart
import 'package:flutter/material.dart';
import 'package:mcp_toolkit/mcp_toolkit.dart';
import 'dart:async';

Future<void> main() async {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      MCPToolkitBinding.instance
        ..initialize() // Initializes the Toolkit
        ..initializeFlutterToolkit(); // Adds Flutter related methods to the MCP server
      runApp(const MyApp());
    },
    (error, stack) {
      // Critical: Handle zone errors for MCP server error reporting
      MCPToolkitBinding.instance.handleZoneError(error, stack);
    },
  );
}

// ... rest of your app code
```

### 5. Start Flutter App with Required Flags

Start your Flutter application with the following command:

```bash
flutter run --debug --host-vmservice-port=8182 --dds-port=8181 --enable-vm-service --disable-service-auth-codes
```

**Note**: The `--disable-service-auth-codes` flag is currently required as a security workaround.

### 6. Configure Your AI Tool

Choose your AI assistant and follow the corresponding configuration:

#### For Cline AI

1. Create or update `.cline/config.json` in your project:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "node",
      "args": ["/path/to/your/cloned/mcp_flutter/mcp_server/build/index.js"],
      "env": {
        "PORT": "3334",
        "LOG_LEVEL": "critical",
        "RESOURCES_SUPPORTED": "true",
        "IMAGES_SUPPORTED": "true"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

2. Restart Cline
3. Flutter inspector tools will be automatically available

#### For Cursor

**⚠️ Important**: Cursor doesn't support resources, so set `RESOURCES_SUPPORTED=false`

1. Open Cursor settings
2. Navigate to Features → Model Context Protocol
3. Add the server configuration:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "node",
      "args": ["/path/to/your/cloned/mcp_flutter/mcp_server/build/index.js"],
      "env": {
        "RESOURCES_SUPPORTED": "false",
        "IMAGES_SUPPORTED": "true",
        "LOG_LEVEL": "critical"
      },
      "disabled": false
    }
  }
}
```

4. Restart Cursor
5. Open Agent Panel (Cmd+L on macOS)
6. Test with commands like "analyze my Flutter app's widget tree"

#### For Claude Desktop

1. Add to your Claude configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "node",
      "args": ["/path/to/your/cloned/mcp_flutter/mcp_server/build/index.js"],
      "env": {
        "PORT": "3334",
        "LOG_LEVEL": "critical"
      },
      "disabled": false
    }
  }
}
```

2. Restart Claude Desktop
3. Flutter inspector tools will be automatically available

## Verification

To verify the installation is successful:

1. Ensure your Flutter app is running with the specified flags
2. Start your AI assistant
3. Try commands like:
   - "Show me the widget tree"
   - "Take a screenshot of the app"
   - "Get runtime errors"

## Important Notes

- **Path Configuration**: Replace `/path/to/your/cloned/mcp_flutter/` with the actual absolute path to your cloned repository
- **Security**: The `--disable-service-auth-codes` flag is a temporary workaround
- **Debug Mode**: The Flutter app must be running in debug mode for the inspector to work
- **Port Configuration**: Default ports are 8182 (vmservice) and 8181 (dds)

## Troubleshooting

- **Connection Issues**: Ensure Flutter app is running with the correct ports
- **MCP Server Not Found**: Verify the path to `build/index.js` is correct
- **Permission Errors**: Check file permissions for the cloned repository
- **Tool Not Available**: Restart your AI assistant after configuration changes

## Environment Variables Reference

- `PORT`: MCP server port (default: 3334)
- `LOG_LEVEL`: Logging level (options: critical, error, warn, info, debug)
- `RESOURCES_SUPPORTED`: Enable/disable resource support (true/false)
- `IMAGES_SUPPORTED`: Enable/disable image support (true/false)
