// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:async';
import 'dart:convert';

import 'package:dart_mcp/server.dart';
import 'package:equatable/equatable.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:meta/meta.dart';

/// Entry for a dynamically registered tool - fully MCP compliant
@immutable
final class DynamicToolEntry with EquatableMixin {
  const DynamicToolEntry({
    required this.tool,
    required this.sourceApp,
    required this.dartVmPort,
    required this.registeredAt,
    this.metadata = const {},
  });

  final Tool tool;
  final String sourceApp;
  final int dartVmPort;
  final DateTime registeredAt;
  final Map<String, dynamic> metadata;

  @override
  bool? get stringify => true;

  @override
  List<Object?> get props => [
    tool,
    sourceApp,
    dartVmPort,
    registeredAt,
    metadata,
  ];
}

/// Entry for a dynamically registered resource - fully MCP compliant
@immutable
final class DynamicResourceEntry with EquatableMixin {
  const DynamicResourceEntry({
    required this.resource,
    required this.sourceApp,
    required this.dartVmPort,
    required this.registeredAt,
    this.metadata = const {},
  });

  final Resource resource;
  final String sourceApp;
  final int dartVmPort;
  final DateTime registeredAt;
  final Map<String, dynamic> metadata;

  @override
  bool? get stringify => true;

  @override
  List<Object?> get props => [
    resource,
    sourceApp,
    dartVmPort,
    registeredAt,
    metadata,
  ];
}

/// Statistics for the dynamic registry
@immutable
final class DynamicRegistryStats with EquatableMixin {
  const DynamicRegistryStats({
    required this.toolCount,
    required this.resourceCount,
    required this.app,
  });

  final int toolCount;
  final int resourceCount;
  final DynamicAppInfo app;

  @override
  bool? get stringify => true;

  @override
  List<Object?> get props => [toolCount, resourceCount, app];
}

/// Information about a registered app
@immutable
extension type const DynamicAppInfo._(Map<String, Object?> _value)
    implements Map<String, Object?> {
  factory DynamicAppInfo({
    required final String name,
    required final int port,
    required final int toolCount,
    required final int resourceCount,
    required final DateTime lastActivity,
  }) => DynamicAppInfo._({
    'name': name,
    'port': port,
    'toolCount': toolCount,
    'resourceCount': resourceCount,
    'lastActivity': lastActivity.millisecondsSinceEpoch,
  });

  String get name => jsonDecodeString(_value['name']);
  int get port => jsonDecodeInt(_value['port']);
  int get toolCount => jsonDecodeInt(_value['toolCount']);
  int get resourceCount => jsonDecodeInt(_value['resourceCount']);
  DateTime get lastActivity => DateTime.fromMillisecondsSinceEpoch(
    jsonDecodeInt(_value['lastActivity']),
  );
}

/// Event emitted when registry changes
@immutable
sealed class DynamicRegistryEvent {
  const DynamicRegistryEvent({required this.timestamp});

  final DateTime timestamp;
}

final class ToolRegisteredEvent extends DynamicRegistryEvent {
  const ToolRegisteredEvent({required super.timestamp, required this.entry});

  final DynamicToolEntry entry;
}

final class ToolUnregisteredEvent extends DynamicRegistryEvent {
  const ToolUnregisteredEvent({
    required super.timestamp,
    required this.toolName,
    required this.sourceApp,
  });

  final String toolName;
  final String sourceApp;
}

final class ResourceRegisteredEvent extends DynamicRegistryEvent {
  const ResourceRegisteredEvent({
    required super.timestamp,
    required this.entry,
  });

  final DynamicResourceEntry entry;
}

final class ResourceUnregisteredEvent extends DynamicRegistryEvent {
  const ResourceUnregisteredEvent({
    required super.timestamp,
    required this.resourceUri,
    required this.sourceApp,
  });

  final String resourceUri;
  final String sourceApp;
}

final class AppUnregisteredEvent extends DynamicRegistryEvent {
  const AppUnregisteredEvent({
    required super.timestamp,
    required this.sourceApp,
    required this.toolsRemoved,
    required this.resourcesRemoved,
  });

  final String sourceApp;
  final int toolsRemoved;
  final int resourcesRemoved;
}

/// Tool call forwarding result for dynamic tools
final class DynamicToolCallResult {
  const DynamicToolCallResult({required this.entry, required this.result});

  final DynamicToolEntry entry;
  final CallToolResult result;
}

/// Resource read forwarding result for dynamic resources
final class DynamicResourceResult {
  const DynamicResourceResult({required this.entry, required this.content});

  final DynamicResourceEntry entry;
  final List<Content> content;
}

/// Dynamic registry for tools and resources registered by Flutter applications
/// Manages runtime registration and cleanup with event-driven architecture
/// Fully compatible with MCP protocol defined in tools.dart
final class DynamicRegistry {
  DynamicRegistry({required this.logger});

  final LoggingSupport logger;

  // Storage - keyed for fast MCP protocol lookups
  final Map<String, DynamicToolEntry> _tools = {};
  final Map<String, DynamicResourceEntry> _resources = {};

  // Single app connection tracking
  String? _currentApp;
  int? _currentPort;
  DateTime? _lastActivity;

  /// Get current connected app name
  String get currentApp => _currentApp ?? 'No app connected';

  /// Get current app port
  int get currentPort => _currentPort ?? 0;

  /// Get last activity timestamp
  DateTime get lastActivity => _lastActivity ?? DateTime.now();

  /// Check if there's a connected app
  bool get hasConnectedApp => _currentApp != null;

  // Event streaming
  final _eventController = StreamController<DynamicRegistryEvent>.broadcast();

  /// Stream of registry events
  Stream<DynamicRegistryEvent> get events => _eventController.stream;

  /// Register a new tool from a Flutter application
  /// Tool must be MCP-compliant with proper name, description, and inputSchema
  void registerTool(
    final Tool tool,
    final String sourceApp,
    final int dartVmPort, {
    final Map<String, dynamic> metadata = const {},
  }) {
    // Handle app switching
    if (_currentApp != null && _currentApp != sourceApp) {
      logger.log(
        LoggingLevel.info,
        'Switching from app $_currentApp to $sourceApp, '
        'clearing previous registrations',
        logger: 'DynamicRegistry',
      );
      _clearCurrentRegistrations();
    }

    final entry = DynamicToolEntry(
      tool: tool,
      sourceApp: sourceApp,
      dartVmPort: dartVmPort,
      registeredAt: DateTime.now(),
      metadata: metadata,
    );

    _tools[tool.name] = entry;
    _currentApp = sourceApp;
    _currentPort = dartVmPort;
    _lastActivity = DateTime.now();

    logger.log(
      LoggingLevel.info,
      'Registered MCP tool: ${tool.name} from $sourceApp:$dartVmPort',
      logger: 'DynamicRegistry',
    );

    _eventController.add(
      ToolRegisteredEvent(timestamp: DateTime.now(), entry: entry),
    );
  }

  /// Register a new resource from a Flutter application
  /// Resource must be MCP-compliant with proper uri, name, description
  void registerResource(
    final Resource resource,
    final String sourceApp,
    final int dartVmPort, {
    final Map<String, dynamic> metadata = const {},
  }) {
    // Handle app switching
    if (_currentApp != null && _currentApp != sourceApp) {
      logger.log(
        LoggingLevel.info,
        'Switching from app $_currentApp to $sourceApp, '
        'clearing previous registrations',
        logger: 'DynamicRegistry',
      );
      _clearCurrentRegistrations();
    }

    final entry = DynamicResourceEntry(
      resource: resource,
      sourceApp: sourceApp,
      dartVmPort: dartVmPort,
      registeredAt: DateTime.now(),
      metadata: metadata,
    );

    _resources[resource.uri] = entry;
    _currentApp = sourceApp;
    _currentPort = dartVmPort;
    _lastActivity = DateTime.now();

    logger.log(
      LoggingLevel.info,
      'Registered MCP resource: ${resource.uri} from $sourceApp:$dartVmPort',
      logger: 'DynamicRegistry',
    );

    _eventController.add(
      ResourceRegisteredEvent(timestamp: DateTime.now(), entry: entry),
    );
  }

  /// Remove all tools and resources from a specific app
  void unregisterApp(final String sourceApp) {
    if (_currentApp != sourceApp) {
      logger.log(
        LoggingLevel.warning,
        'Attempted to unregister $sourceApp but current app is $_currentApp',
        logger: 'DynamicRegistry',
      );
      return;
    }

    final toolsCount = _tools.length;
    final resourcesCount = _resources.length;

    _clearCurrentRegistrations();

    _eventController.add(
      AppUnregisteredEvent(
        timestamp: DateTime.now(),
        sourceApp: sourceApp,
        toolsRemoved: toolsCount,
        resourcesRemoved: resourcesCount,
      ),
    );
  }

  /// Clear all current registrations
  void _clearCurrentRegistrations() {
    // Remove all tools
    for (final entry in _tools.values) {
      logger.log(
        LoggingLevel.info,
        'Unregistered MCP tool: ${entry.tool.name} from ${entry.sourceApp}',
        logger: 'DynamicRegistry',
      );
      _eventController.add(
        ToolUnregisteredEvent(
          timestamp: DateTime.now(),
          toolName: entry.tool.name,
          sourceApp: entry.sourceApp,
        ),
      );
    }

    // Remove all resources
    for (final entry in _resources.values) {
      logger.log(
        LoggingLevel.info,
        'Unregistered MCP resource: ${entry.resource.uri} from '
        '${entry.sourceApp}',
        logger: 'DynamicRegistry',
      );
      _eventController.add(
        ResourceUnregisteredEvent(
          timestamp: DateTime.now(),
          resourceUri: entry.resource.uri,
          sourceApp: entry.sourceApp,
        ),
      );
    }

    _tools.clear();
    _resources.clear();
    _currentApp = null;
    _currentPort = null;
    _lastActivity = null;
  }

  /// Clear all registrations for a specific app (alias for unregisterApp)
  void clearAppRegistrations(final String sourceApp) =>
      unregisterApp(sourceApp);

  /// Handle port change - treat as new app registration
  void handlePortChange(final String sourceApp, final int newPort) {
    if (_currentApp == sourceApp && _currentPort != newPort) {
      logger.log(
        LoggingLevel.info,
        'Port changed for $sourceApp: $_currentPort -> $newPort',
        logger: 'DynamicRegistry',
      );
      _currentPort = newPort;
      _lastActivity = DateTime.now();
    }
  }

  /// Get all dynamically registered tools for MCP ListToolsResult
  List<Tool> getDynamicTools() =>
      _tools.values.map((final entry) => entry.tool).toList();

  /// Get all dynamically registered resources for MCP ListResourcesResult
  List<Resource> getDynamicResources() =>
      _resources.values.map((final entry) => entry.resource).toList();

  /// Get all tool entries with metadata
  List<DynamicToolEntry> getToolEntries() => _tools.values.toList();

  /// Get all resource entries with metadata
  List<DynamicResourceEntry> getResourceEntries() => _resources.values.toList();

  /// Get tool entry by name for MCP CallToolRequest handling
  DynamicToolEntry? getToolEntry(final String name) => _tools[name];

  /// Get resource entry by URI for MCP ReadResourceRequest handling
  DynamicResourceEntry? getResourceEntry(final String uri) => _resources[uri];

  /// Check if a tool is dynamically registered (for MCP tool routing)
  bool isDynamicTool(final String name) => _tools.containsKey(name);

  /// Check if a resource is dynamically registered (for MCP resource routing)
  bool isDynamicResource(final String uri) => _resources.containsKey(uri);

  /// Forward MCP tool call to the appropriate Flutter app
  /// Returns null if tool not found, otherwise forwards the call
  Future<CallToolResult?> forwardToolCall(
    final String toolName,
    final Map<String, Object?>? arguments,
  ) async {
    final entry = getToolEntry(toolName);
    if (entry == null) {
      return null;
    }

    updateAppActivity(entry.sourceApp);

    try {
      // Here you would implement the actual communication to the Flutter app
      // For now, return a placeholder indicating where the call should go
      return CallToolResult(
        content: [
          TextContent(
            text:
                'Tool forwarded to ${entry.sourceApp} on port '
                '${entry.dartVmPort}. Arguments: ${jsonEncode(arguments)}',
          ),
        ],
        isError: false,
      );
    } on Exception catch (e) {
      logger.log(
        LoggingLevel.error,
        'Failed to forward tool call to ${entry.sourceApp}: $e',
        logger: 'DynamicRegistry',
      );

      return CallToolResult(
        content: [TextContent(text: 'Error forwarding tool call: $e')],
        isError: true,
      );
    }
  }

  /// Forward MCP resource read to the appropriate Flutter app
  /// Returns null if resource not found, otherwise forwards the read
  Future<ReadResourceResult?> forwardResourceRead(
    final String resourceUri,
  ) async {
    final entry = getResourceEntry(resourceUri);
    if (entry == null) {
      return null;
    }

    updateAppActivity(entry.sourceApp);

    try {
      // TODO(arenuvern): forward call to the Dart VM -> Flutter App

      return ReadResourceResult(
        contents: [
          TextResourceContents(
            uri: resourceUri,
            text:
                'Resource read forwarded to ${entry.sourceApp} on port '
                '${entry.dartVmPort} for resource: $resourceUri',
          ),
        ],
      );
    } on Exception catch (e) {
      logger.log(
        LoggingLevel.error,
        'Failed to forward resource read to ${entry.sourceApp}: $e',
        logger: 'DynamicRegistry',
      );

      return ReadResourceResult(
        contents: [
          TextResourceContents(
            uri: resourceUri,
            text: 'Error forwarding resource read: $e',
          ),
        ],
      );
    }
  }

  /// Get registry statistics
  DynamicRegistryStats getStats() {
    // Create app info for current connection
    final app = DynamicAppInfo(
      name: currentApp,
      port: currentPort,
      toolCount: _tools.length,
      resourceCount: _resources.length,
      lastActivity: lastActivity,
    );

    return DynamicRegistryStats(
      toolCount: _tools.length,
      resourceCount: _resources.length,
      app: app,
    );
  }

  /// Get tools and resources for the current app
  ({List<DynamicToolEntry> tools, List<DynamicResourceEntry> resources})
  getCurrentAppEntries() => (
    tools: _tools.values.toList(),
    resources: _resources.values.toList(),
  );

  /// Get tools and resources for a specific app (for backward compatibility)
  ({List<DynamicToolEntry> tools, List<DynamicResourceEntry> resources})
  getAppEntries(final String sourceApp) {
    if (_currentApp == sourceApp) {
      return getCurrentAppEntries();
    }
    return (tools: <DynamicToolEntry>[], resources: <DynamicResourceEntry>[]);
  }

  /// Update app activity timestamp
  void updateAppActivity(final String sourceApp) {
    if (_currentApp == sourceApp) {
      _lastActivity = DateTime.now();
    }
  }

  /// Cleanup and dispose
  void dispose() {
    unawaited(_eventController.close());
    _tools.clear();
    _resources.clear();
  }

  @override
  String toString() =>
      'DynamicRegistry(${_tools.length} tools, '
      '${_resources.length} resources)';
}
