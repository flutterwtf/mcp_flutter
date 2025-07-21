# Overview

The whole server is now divided into two parts:

## AI Agent Tools

### Error Analysis

- `get_app_errors` [Resource|Tool] - Retrieves precise and condensed error information from your Flutter app
  **Usage**:

  - Uses only short description of the error. Should filter duplicate errors, to avoid flooding Agent context window with the same errors.
  - Uses Error Monitor to capture Dart VM errors. All errors captured in Flutter app, and then available by request from MCP server.

  **Tested on**:
  ✅ macOS, ✅ iOS
  **Not tested on**:
  🚧 Android, 🤔 Windows, 🤔 Linux, ❌ Web
  [See issue](https://github.com/Arenukvern/mcp_flutter/issues/23)

### Development Tools

- `view_screenshot` [Resource|Tool] - Captures a screenshots of the running application.
  **Configuration**:

  - Enable with `--images` flag or `IMAGES_SUPPORTED=true` environment variable
  - Will use PNG compression to optimize image size.
  <!-- - `hot_reload` [Tool] - Performs hot reload of the Flutter application
    **Tested on**:
    ✅ macOS, ✅ iOS, ✅ Android
    **Not tested on**:
    🤔 Windows, 🤔 Linux, ❌ Web
    [See issue](https://github.com/Arenukvern/mcp_flutter/issues/23)

  **Tested on**:
  ✅ macOS, ✅ iOS
  **Not tested on**:
  🚧 Android, 🤔 Windows, 🤔 Linux, ❌ Web
  [See issue](https://github.com/Arenukvern/mcp_flutter/issues/23) -->

- `get_view_details` [Resource|Tool] - size of screen, pixel ratio. May unlock ability for an Agent to use widget selection.

### Testing Tools

- `tap_by_text` [Tool] - Find TextButton, ElevatedButton or GestureDetector with child widget Text with the passed string
  **Usage**:

  - Write the AI agent the text that is on the button and wait.
  - Write action instructions to the AI agent, telling it to call `view_screenshots` after each action so that it continues to follow the script itself by clicking buttons.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `tap_by_semantic_label` [Tool] - Tap widgets by their semantic label for accessibility testing
  **Usage**:

  - Provide the semantic label of the widget you want to tap.
  - Useful for testing accessibility features and finding widgets by their accessibility labels.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `tap_by_coordinate` [Tool] - Tap widgets at specific screen coordinates
  **Usage**:

  - Provide x and y coordinates to tap at that specific location.
  - Useful for precise interaction testing and automation.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `long_press` [Tool] - Perform long press on widgets by text, key, or semantic label
  **Usage**:

  - Provide query text, key, or semantic label to match the widget.
  - Configurable duration for the long press action.
  - Useful for testing context menus and long press interactions.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `enter_text_by_hint` [Tool] - Looks for a TextField that has `hintText` equal to the `hint` parameter. If found and if TextField has controller, sets `text` to controller. If there is no controller but element is a StatefulElement, tries to reach EditableTextState and manually update TextEditingValue. If onChanged is set, manually calls it.
  **Usage**:

  - Write the AI agent the hint text of TextField and text that you want to write in it and wait.
  - Write input data as well as action instructions to the AI agent, instructing it to call 'view_screenshots' after each action so that it continues to follow the script and determine its next step.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

### Navigation Tools

- `get_navigation_stack` [Tool] - Get the current navigation stack (supports Navigator 2.0 and basic 1.0)
  **Usage**:

  - Returns the current navigation stack information.
  - Useful for understanding the app's navigation state.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `get_navigation_tree` [Tool] - Get the navigation tree (GoRouter, AutoRoute, or fallback)
  **Usage**:

  - Returns detailed navigation tree structure.
  - Supports GoRouter, AutoRoute, and standard Navigator patterns.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `pop_screen` [Tool] - Pop the current screen (Navigator.pop, GoRouter, AutoRouter)
  **Usage**:

  - Automatically detects and uses the appropriate navigation system.
  - Supports Navigator 1.0, 2.0, GoRouter, and AutoRouter.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `navigate_to_route` [Tool] - Navigate to a route by string (GoRouter, AutoRoute, Navigator)
  **Usage**:

  - Provide route string to navigate to.
  - Automatically detects and uses the appropriate navigation system.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

### Widget Inspection Tools

- `view_widget_tree` [Tool] - View the widget tree structure
  **Usage**:

  - Returns serialized widget tree with optional render parameters.
  - Useful for understanding the current UI structure and debugging layout issues.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `get_widget_properties` [Tool] - Get widget properties by key
  **Usage**:

  - Provide widget key to get detailed properties and diagnostics.
  - Returns size, offset, and diagnostic information for the specified widget.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

- `scroll_by_offset` [Tool] - Scroll a scrollable widget by a given offset
  **Usage**:

  - Provide dx and dy offsets to scroll by.
  - Supports filtering by key, semantic label, or text content.
  - Automatically detects and scrolls the appropriate scrollable widget.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOS, 🤔 Windows, 🤔 Linux, ❌ Web

### Work in progress

- [Resource|Tool] **Selection tool**:
  Current idea:

  1. Enable widget selection in Flutter Inspector.
  2. Select widget by logical pixel position.
  3. Get detailed information about your Flutter app's structure based on logical pixel position.

### In research:

- **Inspect Current Route**: See current navigation state
- **Extensions: Flutter Provider/Riverpod states**: Get state of Provider/Riverpod instances.
- **Extensions: Jaspr**: ?
- **Extensions: Jaspr Provider**: ?
- **Extensions: Flame**: ?

## Direct RPC Dart VM Calls

Debug methods, utility methods, which are useful for experimenting with MCP development. Most of these methods are quite heavy and can overload context window of MCP agent.

### Utility Methods

These are helper methods that provide additional functionality beyond direct Flutter RPC calls:

#### VM finding (useful for debugging)

- `get_active_ports`: Lists all Flutter/Dart processes listening on ports
- `get_supported_protocols`: Retrieves supported protocols from a Flutter app
- `get_vm`: Gets detailed VM information from a running Flutter app
- `get_extension_rpcs`: Lists all available extension RPCs in the Flutter app

#### DartIO Methods (ext.dart.io.\*)

- `dart_io_get_version`: Gets Flutter version information

#### Dumps (To enable, use `--dumps` flag or ENV variable DUMPS_SUPPORTED=true)

- `debug_dump_render_tree`: Dumps the render tree structure
- `debug_dump_layer_tree`: Dumps the layer tree for rendering analysis
- `debug_dump_semantics_tree`: Dumps the semantics tree for accessibility analysis
- `debug_dump_focus_tree`: Dumps the focus tree for input handling analysis
