## 2.0.0

This release removes the forwarding server, devtools extension and refactors all communication to use Dart VM.

Note that setup is changed - see new [Quick Start](QUICK_START.md) and [Configuration](CONFIGURATION.md) docs.

The major change, is that now you can control what MCP Server will receive from your Flutter app.

This is made, by introducing new package - [mcp_toolkit](https://github.com/Arenukvern/mcp_flutter/tree/main/mcp_toolkit).

This package working on the same principle as WidgetBinding - it collects information from your Flutter app and sends it to Dart VM when MCP Server requests it.

You can override or add only tools you need.

For example, if you want to add Flutter tools, you can use `initializeFlutterToolkit()` method like one below.

```dart
MCPToolkitBinding.instance
  ..initialize()
  ..initializeFlutterToolkit();
```

## 1.0.0

Stable release with forwarding server and devtools extension.

```

```
