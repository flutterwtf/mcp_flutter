// ignore_for_file: avoid_catches_without_on_clauses

import 'dart:async';
import 'dart:developer' as developer;

import '../mcp_models.dart';
import 'mcp_client_service.dart';

/// A mixin that provides MCP client monitoring and management capabilities.
/// Can be used with any class to add MCP client functionality.
mixin MCPClientMonitor {
  MCPClientService? _mcpClient;
  final Set<MCPCallEntry> _registeredEntries = {};

  /// Get the MCP client instance
  MCPClientService? get mcpClient => _mcpClient;

  /// Check if connected to MCP server
  bool get isConnectedToMCPServer => _mcpClient?.isConnected ?? false;

  /// Get locally registered entries
  Set<MCPCallEntry> get localEntries => Set.unmodifiable(_registeredEntries);

  /// Initialize MCP client for auto-discovery
  void initializeMCPClient({
    final MCPServerConfig? mcpServerConfig,
    final bool enableAutoDiscovery = true,
  }) {
    if (enableAutoDiscovery) {
      _mcpClient = MCPClientService(
        config: mcpServerConfig ?? const MCPServerConfig(),
      );

      // Attempt to connect to MCP server
      unawaited(connectToMCPServer());
    }
  }

  /// Connect to the MCP server
  Future<void> connectToMCPServer() async {
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
    } catch (e, stackTrace) {
      developer.log(
        '[MCPToolkit] Error connecting to MCP server: $e',
        name: 'mcp_toolkit',
        error: e,
        stackTrace: stackTrace,
        level: 900,
      );
    }
  }

  /// Auto-register entries with the MCP server
  Future<void> autoRegisterEntries(final Set<MCPCallEntry> entries) async {
    if (_mcpClient == null || !_mcpClient!.isConnected) {
      developer.log(
        '[MCPToolkit] Cannot auto-register: MCP client not connected',
        name: 'mcp_toolkit',
        level: 900,
      );
      return;
    }
    _registeredEntries.addAll(entries);

    final tools = <MCPToolDefinition>[];
    final resources = <MCPResourceDefinition>[];

    for (final entry in entries) {
      // Use existing tool definition if available, otherwise
      // create a default one
      if (entry.hasTool) {
        tools.add(entry.value.toolDefinition!);
      } else {
        // Create a default tool definition for entries without one
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

      // Register resources if available
      if (entry.hasResource) {
        resources.add(entry.value.resourceDefinition!);
      }
    }

    try {
      var success = true;

      // Register tools if any
      if (tools.isNotEmpty) {
        success = await _mcpClient!.registerTools(tools);
        if (success) {
          developer.log(
            '[MCPToolkit] Auto-registered ${tools.length} '
            'tools with MCP server',
            name: 'mcp_toolkit',
          );
        } else {
          developer.log(
            '[MCPToolkit] Failed to auto-register tools with MCP server',
            name: 'mcp_toolkit',
            level: 900,
          );
        }
      }

      // Register resources if any
      if (resources.isNotEmpty && success) {
        success = await _mcpClient!.registerResources(resources);
        if (success) {
          developer.log(
            '[MCPToolkit] Auto-registered ${resources.length} '
            'resources with MCP server',
            name: 'mcp_toolkit',
          );
        } else {
          developer.log(
            '[MCPToolkit] Failed to auto-register resources with MCP server',
            name: 'mcp_toolkit',
            level: 900,
          );
        }
      }
    } catch (e, stackTrace) {
      developer.log(
        '[MCPToolkit] Failed to auto-register tools/resources: $e',
        name: 'mcp_toolkit',
        error: e,
        level: 900,
        stackTrace: stackTrace,
      );
    }
  }

  /// Manually register a custom tool with the MCP server
  Future<bool> registerCustomTool(final MCPToolDefinition tool) async {
    if (_mcpClient == null) {
      developer.log(
        '[MCPToolkit] MCP client not initialized. Call '
        'initializeMCPClient() with enableAutoDiscovery: true',
        name: 'mcp_toolkit',
        level: 900,
        stackTrace: StackTrace.current,
      );
      return false;
    }

    if (!_mcpClient!.isConnected) {
      developer.log(
        '[MCPToolkit] MCP client not connected. Attempting to connect...',
        name: 'mcp_toolkit',
        level: 900,
        stackTrace: StackTrace.current,
      );

      final connected = await _mcpClient!.connect();
      if (!connected) {
        developer.log(
          '[MCPToolkit] Failed to connect to MCP server',
          name: 'mcp_toolkit',
          level: 900,
          stackTrace: StackTrace.current,
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
        '[MCPToolkit] MCP client not initialized. '
        'Call initializeMCPClient() with enableAutoDiscovery: true',
        name: 'mcp_toolkit',
        level: 900,
        stackTrace: StackTrace.current,
      );
      return false;
    }

    if (!_mcpClient!.isConnected) {
      developer.log(
        '[MCPToolkit] MCP client not connected. Attempting to connect...',
        name: 'mcp_toolkit',
        level: 900,
        stackTrace: StackTrace.current,
      );

      final connected = await _mcpClient!.connect();
      if (!connected) {
        developer.log(
          '[MCPToolkit] Failed to connect to MCP server',
          name: 'mcp_toolkit',
          level: 900,
          stackTrace: StackTrace.current,
        );
        return false;
      }
    }

    return _mcpClient!.registerResource(resource);
  }

  /// Dispose MCP client resources
  Future<void> disposeMCPClient() async {
    await _mcpClient?.disconnect();
    _mcpClient = null;
  }
}
