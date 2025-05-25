# LLM Installation Guide: MCP Flutter Inspector

## 0. AI Agent Instructions

**Attention AI Agent:** This guide outlines the process for installing the MCP Flutter Inspector server. Your primary role is to:

1.  **Gather Information:** First, you _must_ interact with the USER to obtain specific paths and preferences.
2.  **Execute Steps:** Once all necessary information is gathered, proceed with the installation steps precisely as described, substituting placeholders with user-provided values.
3.  **Verify:** Confirm with the USER that the installation was successful.

Do not proceed with cloning or modification steps until you have confirmed the necessary paths with the USER.

## Overview

This guide provides step-by-step instructions for AI agents to install and configure the MCP Flutter Inspector server by cloning from GitHub. This tool enables AI assistants to inspect and interact with Flutter applications during development.

## Prerequisites

Before starting the installation, ensure the following requirements are met:

- **Node.js**: Version 14 or later
- **Flutter SDK**: Installed and configured
- **Flutter App**: Running in debug mode (the USER will specify which app).
- **AI Assistant**: Cursor, Claude, Cline AI, Windsurf, RooCode, or any MCP-compatible tool
- **Git**: For cloning the repository

## Installation Steps

### 1. Gather User Information (AI Agent Action)

AI Agent: Before proceeding, you **must** ask the USER the following:

1.  "Where on your system should I clone the `mcp_flutter` repository? Please provide the absolute path to the directory where you keep your MCP server projects." (Let's call this `[MCP_SERVER_BASE_PATH]`)
2.  "Which Flutter application project should I configure for use with the MCP Flutter Inspector? Please provide the absolute path to this Flutter project." (Let's call this `[FLUTTER_APP_PATH]`)

**Do not proceed until you have these paths from the USER.**

### 2. Clone the Repository

AI Agent: Use the `[MCP_SERVER_BASE_PATH]` provided by the USER.

```bash
cd [MCP_SERVER_BASE_PATH]
git clone https://github.com/Arenukvern/mcp_flutter
cd mcp_flutter # This will be [MCP_SERVER_BASE_PATH]/mcp_flutter
```

Let `[CLONED_MCP_FLUTTER_PATH]` be `[MCP_SERVER_BASE_PATH]/mcp_flutter`.

### 3. Install and Build Dependencies

AI Agent: Execute this within `[CLONED_MCP_FLUTTER_PATH]`.

```bash
make install
```

This command will:

- Install all necessary Node.js dependencies from `package.json`
- Build the MCP server automatically

### 4. Add MCP Toolkit to the User's Flutter App

AI Agent: Use the `[FLUTTER_APP_PATH]` provided by the USER.

```bash
cd [FLUTTER_APP_PATH]
flutter pub add mcp_toolkit
```

Alternatively, if the USER prefers, instruct them to manually add to their `pubspec.yaml` within `[FLUTTER_APP_PATH]`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  # ... other dependencies
  mcp_toolkit: ^0.1.2
```

Then, AI Agent, run the following within `[FLUTTER_APP_PATH]`:

```bash
flutter pub get
```

### 5. Initialize MCP Toolkit in the User's Flutter App

AI Agent: Instruct the USER to update their Flutter app's `main.dart` file located at `[FLUTTER_APP_PATH]/lib/main.dart`:

```dart
import \'package:flutter/material.dart\';
import \'package:mcp_toolkit/mcp_toolkit.dart\';
import \'dart:async\';

Future<void> main() async {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      MCPToolkitBinding.instance
        ..initialize() // Initializes the Toolkit
        ..initializeFlutterToolkit(); // Adds Flutter related methods to the MCP server
      runApp(const MyApp()); // Ensure MyApp is their actual root widget
    },
    (error, stack) {
      // Critical: Handle zone errors for MCP server error reporting
      MCPToolkitBinding.instance.handleZoneError(error, stack);
    },
  );
}

// ... rest of their app code
```

AI Agent: Remind the USER to replace `const MyApp()` with their actual root widget if it's different.

### 6. Start Flutter App with Required Flags

AI Agent: Instruct the USER to start their Flutter application (located at `[FLUTTER_APP_PATH]`) with the following command:

```bash
flutter run --debug --host-vmservice-port=8182 --dds-port=8181 --enable-vm-service --disable-service-auth-codes
```

**Note to USER (Relay this):** The `--disable-service-auth-codes` flag is currently required as a security workaround.

### 7. Configure Your AI Tool

AI Agent: Ask the USER which AI assistant they are using (Cursor, Cline AI, Claude Desktop, etc.). Based on their answer, provide the corresponding configuration. Use `[CLONED_MCP_FLUTTER_PATH]` for the path to the server.

#### For Cline AI

1.  AI Agent: Instruct the USER that the configuration for MCP servers with Cline AI is typically managed in a file named `cline_mcp_servers.json` located in a specific user configuration directory.
    The exact path might be `~/Library/Application Support/[Cursor | VSCode or other IDE]/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` on macOS (as per the USER's OS). The USER should verify the correct path for their Cline AI installation or consult more detailed Cline documentation.

    The settings file may have other MCP servers already configured, so you would read it first and then add your new server to the existing `mcpServers` object.

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "node",
      "args": ["[CLONED_MCP_FLUTTER_PATH]/mcp_server/build/index.js"],
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

2.  AI Agent: Instruct the USER to restart Cline.
3.  Flutter inspector tools will be automatically available.

#### For Cursor

**⚠️ Important (Relay to USER):** Cursor doesn't support resources, so `RESOURCES_SUPPORTED` must be `false`.

1.  AI Agent: Instruct the USER that the configuration for MCP servers with Cursor AI is typically managed in a file named `~/.cursor/mcp.json`.

    The settings file may have other MCP servers already configured, so you would read it first and then add your new server to the existing `mcpServers` object.

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "node",
      "args": ["[CLONED_MCP_FLUTTER_PATH]/mcp_server/build/index.js"],
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

4.  AI Agent: Instruct the USER to restart Cursor.
5.  Open Agent Panel (Cmd+L on macOS).
6.  Test with commands like "call view_screenshots".

#### For Claude Desktop

1.  AI Agent: Instruct the USER to add to their Claude configuration file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS; confirm path with user if different):

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "node",
      "args": ["[CLONED_MCP_FLUTTER_PATH]/mcp_server/build/index.js"],
      "env": {
        "PORT": "3334",
        "LOG_LEVEL": "critical",
        "RESOURCES_SUPPORTED": "true", // Assuming Claude supports this, adjust if known otherwise
        "IMAGES_SUPPORTED": "true" // Assuming Claude supports this
      },
      "disabled": false
    }
  }
}
```

2.  AI Agent: Instruct the USER to restart Claude Desktop.
3.  Flutter inspector tools will be automatically available.

## Verification

AI Agent: To verify with the USER that the installation is successful:

1.  Confirm their Flutter app (from `[FLUTTER_APP_PATH]`) is running with the specified flags.
2.  Confirm their AI assistant has been restarted after configuration.
3.  Ask them to try commands like:
    - "Show me the widget tree"
    - "Take a screenshot of the app"
    - "Get runtime errors"

## Important Notes for the USER (Relay these)

- **Path Configuration**: Ensure all paths like `[CLONED_MCP_FLUTTER_PATH]` and `[FLUTTER_APP_PATH]` were correctly substituted with your actual absolute paths.
- **Security**: The `--disable-service-auth-codes` flag is a temporary workaround.
- **Debug Mode**: The Flutter app must be running in debug mode for the inspector to work.
- **Port Configuration**: Default ports used by the Flutter app are 8182 (VM service) and 8181 (DDS). The MCP server itself defaults to port 3334 if not overridden by the AI tool's config.

## Troubleshooting (AI Agent: Use this to help USER)

- **Connection Issues**:
  - Verify Flutter app is running with correct flags and ports (`--host-vmservice-port=8182 --dds-port=8181`).
  - Check AI tool's MCP server configuration for correct command, arguments (path to `index.js`), and environment variables (especially `PORT` if manually set).
- **MCP Server Not Found**:
  - Double-check that `[CLONED_MCP_FLUTTER_PATH]/mcp_server/build/index.js` is the correct and absolute path to the built server script.
  - Ensure `make install` in Step 3 completed successfully and created the `build` directory.
- **Permission Errors**:
  - Check file permissions for `[CLONED_MCP_FLUTTER_PATH]` and its subdirectories.
- **Tool Not Available in AI Assistant**:
  - Ensure the AI assistant was restarted after its MCP configuration was updated.
  - Verify the `disabled: false` flag in the MCP server configuration for the AI tool.

## Environment Variables Reference (for MCP Server `index.js`)

- `PORT`: MCP server listening port (default: 3334).
- `LOG_LEVEL`: Logging level (options: critical, error, warn, info, debug).
- `RESOURCES_SUPPORTED`: Enable/disable resource support (true/false). Crucial for tools like Cursor (`false`).
- `IMAGES_SUPPORTED`: Enable/disable image support (true/false).
