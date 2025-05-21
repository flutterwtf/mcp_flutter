// ignore_for_file: prefer_asserts_with_message

import 'mcp_bridge_binding_base.dart';
import 'mcp_bridge_extensions.dart';
import 'mcp_bridge_listeners.dart';
import 'mcp_bridge_listeners_impl.dart';
import 'services/error_monitor.dart';

/// The binding for the MCP Bridge.
class McpBridgeBinding extends McpBridgeBindingBase
    with ErrorMonitor, McpBridgeExtensions {
  McpBridgeBinding._();

  /// The singleton instance of the MCP Bridge binding.
  static final instance = McpBridgeBinding._();

  /// Initializes the MCP Bridge binding.
  ///
  /// If [listeners] is not provided, the [McpBridgeListenersImpl] will be used.
  void initialize({final McpBridgeListeners? listeners}) {
    assert(() {
      attachToFlutterError();
      initializeServiceExtension(
        errorMonitor: this,
        listeners:
            listeners ?? McpBridgeListenersImpl()
              ..attachErrorMonitor(this),
      );
      return true;
    }());
  }
}
