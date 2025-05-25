// ignore_for_file: prefer_asserts_with_message

import 'dart:async';

import 'package:flutter/foundation.dart';

import 'mcp_models.dart';
import 'mcp_toolkit_binding_base.dart';
import 'mcp_toolkit_extensions.dart';
import 'services/error_monitor.dart';
import 'services/mcp_client_monitor.dart';
import 'services/mcp_client_service.dart';

/// The binding for the MCP Toolkit.
///
/// Run init, before calling [addEntries].
///
/// To add Flutter tools, call [initializeFlutterToolkit] method.
///
/// Usually, you may use the following setup:
///
/// ```dart
/// import 'package:flutter/material.dart';
/// import 'package:mcp_toolkit/mcp_toolkit.dart'; // Import the package
/// import 'dart:async';
///
/// Future<void> main() async {
///   runZonedGuarded(
///     () async {
///       WidgetsFlutterBinding.ensureInitialized();
///       MCPToolkitBinding.instance
///         ..initialize() // Initializes the Toolkit
///         ..initializeFlutterToolkit(); // Adds Flutter related methods to the MCP server
///       runApp(const MyApp());
///     },
///     (error, stack) {
///       // Optionally, you can also use the bridge's error handling for zone errors
///       MCPToolkitBinding.instance.handleZoneError(error, stack);
///     },
///   );
/// }
/// ```
class MCPToolkitBinding extends MCPToolkitBindingBase
    with ErrorMonitor, MCPClientMonitor, MCPToolkitExtensions {
  MCPToolkitBinding._();

  /// The singleton instance of the MCP Toolkit binding.
  static final instance = MCPToolkitBinding._();

  @override
  void initialize({
    final String serviceExtensionName = kMCPServiceExtensionName,
    final int maxErrors = kDefaultMaxErrors,
    final MCPServerConfig? mcpServerConfig,
    final bool enableAutoDiscovery = true,
  }) {
    assert(() {
      assert(
        kDebugMode,
        'MCP Toolkit should only be initialized in debug mode',
      );
      attachToFlutterError();
      return true;
    }());

    super.initialize(serviceExtensionName: serviceExtensionName);

    // Initialize MCP client for auto-discovery using the mixin
    initializeMCPClient(
      mcpServerConfig: mcpServerConfig,
      enableAutoDiscovery: enableAutoDiscovery,
    );
  }

  /// Initializes the MCP Toolkit binding.
  ///
  /// If [listeners] is not provided, the [MCPToolkitListenersImpl]
  /// will be used.
  Future<void> addEntries({
    required final Set<MCPCallEntry> entries,
    final bool autoRegisterWithServer = true,
  }) async {
    assert(() {
      initializeServiceExtensions(errorMonitor: this, entries: entries);
      return true;
    }());

    // Auto-register with MCP server if enabled
    if (autoRegisterWithServer && isConnectedToMCPServer) {
      await autoRegisterEntries(entries);
    }
  }

  /// Disposes the MCP Toolkit binding.
  Future<void> dispose() async {
    await disposeMCPClient();
  }
}
