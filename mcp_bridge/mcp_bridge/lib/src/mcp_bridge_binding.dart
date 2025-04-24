import 'error_monitor.dart';
import 'mcp_binding_base.dart';
import 'mcp_bridge_extensions.dart';

/// The binding for the MCP Bridge.
class McpBridgeBinding extends McpBridgeBindingBase
    with ErrorMonitor, McpBridgeExtensions {
  McpBridgeBinding._();

  /// The singleton instance of the MCP Bridge binding.
  static final instance = McpBridgeBinding._();

  /// Initializes the MCP Bridge binding.
  void initialize() {
    attachToFlutterError();
    initializeServiceExtension(errorMonitor: this);
  }
}
