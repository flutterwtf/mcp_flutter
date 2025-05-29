# Quick Setup: Flutter Inspector MCP + Cursor

## 🚀 5-Minute Setup

### Step 1: Build the MCP Server

```bash
cd mcp_server_dart
dart compile exe bin/main.dart -o flutter_inspector_mcp
chmod +x flutter_inspector_mcp
```

### Step 2: Configure Cursor

Create or edit `~/.cursor/mcp_servers.json`:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "/Users/antonio/mcp/cline/mcp_flutter/mcp_server_dart/flutter_inspector_mcp",
      "args": [
        "--dart-vm-host=localhost",
        "--dart-vm-port=8181",
        "--resources-supported",
        "--images-supported"
      ]
    }
  }
}
```

### Step 3: Start Flutter App

```bash
cd flutter_test_app
flutter run --debug
```

### Step 4: Test in Cursor

Ask Cursor: _"Hot reload my Flutter app"_

## Alternative: Direct Dart Execution

If you prefer not to compile:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "dart",
      "args": [
        "run",
        "/Users/antonio/mcp/cline/mcp_flutter/mcp_server_dart/bin/main.dart",
        "--dart-vm-port=8181"
      ]
    }
  }
}
```

## Available Commands

Once setup, you can ask Cursor:

- `"Hot reload my Flutter app"`
- `"Get VM information"`
- `"Show me app screenshots"`
- `"What are the latest errors?"`
- `"List extension RPCs"`

## Troubleshooting

**Connection issues?**

- Ensure Flutter app is running: `flutter run --debug`
- Check port 8181 is free: `lsof -i :8181`
- Verify executable permissions: `chmod +x flutter_inspector_mcp`

**Path issues?**

- Use absolute paths in configuration
- Check Dart SDK is in PATH: `which dart`

## Project-Specific Setup

For per-project configuration, create `.cursor/mcp_servers.json` in your Flutter project root:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "dart",
      "args": ["run", "../mcp_server_dart/bin/main.dart"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

---

**Need help?** Check the full documentation in `cursor_mcp_integration.md`
