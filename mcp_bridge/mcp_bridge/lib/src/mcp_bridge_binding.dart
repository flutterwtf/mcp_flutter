import 'error_monitor.dart';
import 'mcp_bridge_extensions.dart';

class McpBridgeBinding with ErrorMonitor, McpBridgeExtensions {
  McpBridgeBinding._();
  static final instance = McpBridgeBinding._();

  void initialize() {
    attachToFlutterError();
    initializeServiceExtension(errorMonitor: this);
  }
}
