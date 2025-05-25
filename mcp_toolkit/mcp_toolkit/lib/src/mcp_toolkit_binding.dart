// ignore_for_file: prefer_asserts_with_message

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

import 'mcp_models.dart';
import 'mcp_toolkit_binding_base.dart';
import 'mcp_toolkit_extensions.dart';
import 'services/error_monitor.dart';
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
    with ErrorMonitor, MCPToolkitExtensions {
  MCPToolkitBinding._();

  /// The singleton instance of the MCP Toolkit binding.
  static final instance = MCPToolkitBinding._();

  MCPClientService? _mcpClient;
  final Set<MCPCallEntry> _registeredEntries = {};

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

    // Initialize MCP client for auto-discovery
    if (enableAutoDiscovery) {
      _mcpClient = MCPClientService(
        config: mcpServerConfig ?? const MCPServerConfig(),
      );

      // Attempt to connect to MCP server
      unawaited(_connectToMCPServer());
    }
  }

  /// Connect to the MCP server
  Future<void> _connectToMCPServer() async {
    if (_mcpClient == null) return;

    try {
      final connected = await _mcpClient!.connect();
      if (connected) {
        developer.log(
          '[MCPToolkit] Successfully connected to MCP server',
          name: 'mcp_toolkit',
        );
      } else {
        developer.log(
          '[MCPToolkit] Failed to connect to MCP server',
          name: 'mcp_toolkit',
          level: 900,
        );
      }
    } catch (e) {
      developer.log(
        '[MCPToolkit] Error connecting to MCP server: $e',
        name: 'mcp_toolkit',
        error: e,
        level: 900,
      );
    }
  }

  /// Initializes the MCP Toolkit binding.
  ///
  /// If [listeners] is not provided, the [MCPToolkitListenersImpl]
  /// will be used.
  void addEntries({
    required final Set<MCPCallEntry> entries,
    final bool autoRegisterWithServer = true,
  }) {
    assert(() {
      initializeServiceExtensions(errorMonitor: this, entries: entries);
      return true;
    }());

    _registeredEntries.addAll(entries);

    // Auto-register with MCP server if enabled
    if (autoRegisterWithServer && _mcpClient != null) {
      unawaited(_autoRegisterEntries(entries));
    }
  }

  /// Auto-register entries with the MCP server
  Future<void> _autoRegisterEntries(final Set<MCPCallEntry> entries) async {
    if (_mcpClient == null || !_mcpClient!.isConnected) {
      developer.log(
        '[MCPToolkit] Cannot auto-register: MCP client not connected',
        name: 'mcp_toolkit',
        level: 900,
      );
      return;
    }

    final tools = <MCPToolDefinition>[];

    for (final entry in entries) {
      // Convert MCPCallEntry to MCPToolDefinition
      final tool = MCPToolDefinition(
        name: entry.key,
        description: 'Flutter app tool: ${entry.key}',
        inputSchema: {
          'type': 'object',
          'properties': {
            'parameters': {
              'type': 'object',
              'description': 'Parameters for the tool call',
            },
          },
        },
      );
      tools.add(tool);
    }

    try {
      final success = await _mcpClient!.registerTools(tools);
      if (success) {
        developer.log(
          '[MCPToolkit] Auto-registered ${tools.length} tools with MCP server',
          name: 'mcp_toolkit',
        );
      } else {
        developer.log(
          '[MCPToolkit] Failed to auto-register tools with MCP server',
          name: 'mcp_toolkit',
          level: 900,
        );
      }
    } catch (e) {
      developer.log(
        '[MCPToolkit] Failed to auto-register tools: $e',
        name: 'mcp_toolkit',
        error: e,
        level: 900,
      );
    }
  }

  /// Manually register a custom tool with the MCP server
  Future<bool> registerCustomTool(final MCPToolDefinition tool) async {
    if (_mcpClient == null) {
      developer.log(
        '[MCPToolkit] MCP client not initialized. Call initialize() with enableAutoDiscovery: true',
        name: 'mcp_toolkit',
        level: 900,
      );
      return false;
    }

    if (!_mcpClient!.isConnected) {
      developer.log(
        '[MCPToolkit] MCP client not connected. Attempting to connect...',
        name: 'mcp_toolkit',
        level: 900,
      );

      final connected = await _mcpClient!.connect();
      if (!connected) {
        developer.log(
          '[MCPToolkit] Failed to connect to MCP server',
          name: 'mcp_toolkit',
          level: 900,
        );
        return false;
      }
    }

    return _mcpClient!.registerTool(tool);
  }

  /// Manually register a custom resource with the MCP server
  Future<bool> registerCustomResource(
    final MCPResourceDefinition resource,
  ) async {
    if (_mcpClient == null) {
      developer.log(
        '[MCPToolkit] MCP client not initialized. Call initialize() with enableAutoDiscovery: true',
        name: 'mcp_toolkit',
        level: 900,
      );
      return false;
    }

    if (!_mcpClient!.isConnected) {
      developer.log(
        '[MCPToolkit] MCP client not connected. Attempting to connect...',
        name: 'mcp_toolkit',
        level: 900,
      );

      final connected = await _mcpClient!.connect();
      if (!connected) {
        developer.log(
          '[MCPToolkit] Failed to connect to MCP server',
          name: 'mcp_toolkit',
          level: 900,
        );
        return false;
      }
    }

    return _mcpClient!.registerResource(resource);
  }

  /// Get current registrations from the MCP server
  /// Note: This method is deprecated as the new dart_mcp API doesn't support this directly
  @Deprecated('Use localEntries to get locally registered entries')
  Future<Map<String, dynamic>?> getServerRegistrations() async {
    developer.log(
      '[MCPToolkit] getServerRegistrations is deprecated. Use localEntries instead.',
      name: 'mcp_toolkit',
      level: 900,
    );
    return null;
  }

  /// Get locally registered entries
  Set<MCPCallEntry> get localEntries => Set.unmodifiable(_registeredEntries);

  /// Get the MCP client instance
  MCPClientService? get mcpClient => _mcpClient;

  /// Check if connected to MCP server
  bool get isConnectedToMCPServer => _mcpClient?.isConnected ?? false;

  Future<void> dispose() async {
    await _mcpClient?.disconnect();
    _mcpClient = null;
  }
}
