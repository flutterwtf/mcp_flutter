# Overview

The whole server is now divided into two parts:

1. Useful tools or resources which can be really be useful for AI agents.
2. Debug methods, utility methods, which are useful for experimenting with MCP development. Most of these methods are quite heavy and can overload context window of MCP agent.

# Direct RPC Dart VM Calls

## Utility Methods

These are helper methods that provide additional functionality beyond direct Flutter RPC calls:

### VM finding (useful for debugging)

- `get_active_ports`: Lists all Flutter/Dart processes listening on ports
- `get_supported_protocols`: Retrieves supported protocols from a Flutter app
- `get_vm`: Gets detailed VM information from a running Flutter app
- `get_extension_rpcs`: Lists all available extension RPCs in the Flutter app

### DartIO Methods (ext.dart.io.\*)

- `dart_io_get_version`: Gets Flutter version information

### Dumps (To enable, use `--dumps` flag or ENV variable DUMPS_SUPPORTED=true)

- `debug_dump_render_tree`: Dumps the render tree structure
- `debug_dump_layer_tree`: Dumps the layer tree for rendering analysis
- `debug_dump_semantics_tree`: Dumps the semantics tree for accessibility analysis
- `debug_dump_focus_tree`: Dumps the focus tree for input handling analysis

# Flutter Inspector (forwarded through MCP Devtools Extension) (ext.flutter.inspector.\*)

- `debug_paint_baselines_enabled`: Toggles baseline paint debugging

## Screenshot (to enable use `--images` flag or ENV variable IMAGES_SUPPORTED=true)

- `ext.flutter.inspector.screenshot`: Takes a screenshot of the current Flutter Inspector view
