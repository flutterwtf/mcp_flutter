// ignore_for_file: prefer_asserts_with_message

import 'mcp_models.dart';
import 'mcp_toolkit_binding_base.dart';
import 'mcp_toolkit_extensions.dart';
import 'services/error_monitor.dart';

/// The binding for the MCP Toolkit.
///
/// Run init, before calling [addEntries].
class MCPToolkitBinding extends MCPToolkitBindingBase
    with ErrorMonitor, MCPToolkitExtensions {
  MCPToolkitBinding._();

  /// The singleton instance of the MCP Toolkit binding.
  static final instance = MCPToolkitBinding._();

  @override
  void initialize({
    final String serviceExtensionName = kMCPServiceExtensionName,
  }) {
    assert(() {
      attachToFlutterError();
      return true;
    }());

    super.initialize(serviceExtensionName: serviceExtensionName);
  }

  /// Initializes the MCP Toolkit binding.
  ///
  /// If [listeners] is not provided, the [MCPToolkitListenersImpl]
  /// will be used.
  void addEntries({required final Set<MCPCallEntry> entries}) {
    assert(() {
      initializeServiceExtensions(errorMonitor: this, entries: entries);
      return true;
    }());
  }
}
