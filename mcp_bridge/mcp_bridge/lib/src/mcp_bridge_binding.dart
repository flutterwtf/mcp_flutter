// ignore_for_file: prefer_asserts_with_message

import 'error_monitor.dart';
import 'mcp_bridge_binding_base.dart';
import 'mcp_bridge_extensions.dart';

/// The binding for the MCP Bridge.
class McpBridgeBinding extends McpBridgeBindingBase
    with ErrorMonitor, McpBridgeExtensions {
  McpBridgeBinding._();

  /// The singleton instance of the MCP Bridge binding.
  static final instance = McpBridgeBinding._();

  /// Initializes the MCP Bridge binding.
  void initialize() {
    assert(() {
      attachToFlutterError();
      initializeServiceExtension(errorMonitor: this);
      return true;
    }());
  }
}
