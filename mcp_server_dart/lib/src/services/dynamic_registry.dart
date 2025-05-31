// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:async';
import 'dart:convert';

import 'package:dart_mcp/server.dart';
import 'package:meta/meta.dart';

/// Entry for a dynamically registered tool - fully MCP compliant
@immutable
final class DynamicToolEntry {
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
  bool operator ==(final Object other) =>
      identical(this, other) ||
      other is DynamicToolEntry &&
          runtimeType == other.runtimeType &&
          tool.name == other.tool.name &&
          sourceApp == other.sourceApp;

  @override
  int get hashCode => Object.hash(tool.name, sourceApp);

  @override
  String toString() => 'DynamicToolEntry(${tool.name}, $sourceApp:$dartVmPort)';
}

/// Entry for a dynamically registered resource - fully MCP compliant
@immutable
final class DynamicResourceEntry {
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
  bool operator ==(final Object other) =>
      identical(this, other) ||
      other is DynamicResourceEntry &&
          runtimeType == other.runtimeType &&
          resource.uri == other.resource.uri &&
          sourceApp == other.sourceApp;

  @override
  int get hashCode => Object.hash(resource.uri, sourceApp);

  @override
  String toString() =>
      'DynamicResourceEntry(${resource.uri}, $sourceApp:$dartVmPort)';
}

/// Statistics for the dynamic registry
@immutable
final class DynamicRegistryStats {
  const DynamicRegistryStats({
    required this.toolCount,
    required this.resourceCount,
    required this.appCount,
    required this.apps,
  });

  final int toolCount;
  final int resourceCount;
  final int appCount;
  final List<DynamicAppInfo> apps;
}

/// Information about a registered app
@immutable
final class DynamicAppInfo {
  const DynamicAppInfo({
    required this.name,
    required this.port,
    required this.toolCount,
    required this.resourceCount,
    required this.lastActivity,
  });

  final String name;
  final int port;
  final int toolCount;
  final int resourceCount;
  final DateTime lastActivity;
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
  final Map<String, int> _appConnections = {}; // appId -> dartVmPort
  final Map<String, DateTime> _appActivity = {}; // appId -> lastActivity

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
    final entry = DynamicToolEntry(
      tool: tool,
      sourceApp: sourceApp,
      dartVmPort: dartVmPort,
      registeredAt: DateTime.now(),
      metadata: metadata,
    );

    _tools[tool.name] = entry;
    _appConnections[sourceApp] = dartVmPort;
    _appActivity[sourceApp] = DateTime.now();

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
    final entry = DynamicResourceEntry(
      resource: resource,
      sourceApp: sourceApp,
      dartVmPort: dartVmPort,
      registeredAt: DateTime.now(),
      metadata: metadata,
    );

    _resources[resource.uri] = entry;
    _appConnections[sourceApp] = dartVmPort;
    _appActivity[sourceApp] = DateTime.now();

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
    var toolsRemoved = 0;
    var resourcesRemoved = 0;

    // Remove tools
    _tools.removeWhere((final toolName, final entry) {
      if (entry.sourceApp == sourceApp) {
        toolsRemoved++;
        logger.log(
          LoggingLevel.info,
          'Unregistered MCP tool: $toolName from $sourceApp',
          logger: 'DynamicRegistry',
        );
        _eventController.add(
          ToolUnregisteredEvent(
            timestamp: DateTime.now(),
            toolName: toolName,
            sourceApp: sourceApp,
          ),
        );
        return true;
      }
      return false;
    });

    // Remove resources
    _resources.removeWhere((final resourceUri, final entry) {
      if (entry.sourceApp == sourceApp) {
        resourcesRemoved++;
        logger.log(
          LoggingLevel.info,
          'Unregistered MCP resource: $resourceUri from $sourceApp',
          logger: 'DynamicRegistry',
        );
        _eventController.add(
          ResourceUnregisteredEvent(
            timestamp: DateTime.now(),
            resourceUri: resourceUri,
            sourceApp: sourceApp,
          ),
        );
        return true;
      }
      return false;
    });

    _appConnections.remove(sourceApp);
    _appActivity.remove(sourceApp);

    if (toolsRemoved > 0 || resourcesRemoved > 0) {
      _eventController.add(
        AppUnregisteredEvent(
          timestamp: DateTime.now(),
          sourceApp: sourceApp,
          toolsRemoved: toolsRemoved,
          resourcesRemoved: resourcesRemoved,
        ),
      );
    }
  }

  /// Clear all registrations for a specific app (alias for unregisterApp)
  void clearAppRegistrations(final String sourceApp) =>
      unregisterApp(sourceApp);

  /// Handle port change - treat as new app registration
  void handlePortChange(final String sourceApp, final int newPort) {
    final oldPort = _appConnections[sourceApp];
    if (oldPort != null && oldPort != newPort) {
      logger.log(
        LoggingLevel.info,
        'Port changed for $sourceApp: $oldPort -> $newPort',
        logger: 'DynamicRegistry',
      );
      unregisterApp(sourceApp);
    }
    _appActivity[sourceApp] = DateTime.now();
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
                'Tool forwarded to ${entry.sourceApp} on port ${entry.dartVmPort}. '
                'Arguments: ${jsonEncode(arguments)}',
          ),
        ],
        isError: false,
      );
    } catch (e, stackTrace) {
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
  Future<List<Content>?> forwardResourceRead(final String resourceUri) async {
    final entry = getResourceEntry(resourceUri);
    if (entry == null) {
      return null;
    }

    updateAppActivity(entry.sourceApp);

    try {
      // Here you would implement the actual communication to the Flutter app
      // For now, return a placeholder indicating where the read should go
      return [
        TextContent(
          text:
              'Resource read forwarded to ${entry.sourceApp} on port ${entry.dartVmPort} '
              'for resource: $resourceUri',
        ),
      ];
    } catch (e, stackTrace) {
      logger.log(
        LoggingLevel.error,
        'Failed to forward resource read to ${entry.sourceApp}: $e',
        logger: 'DynamicRegistry',
      );

      return [TextContent(text: 'Error forwarding resource read: $e')];
    }
  }

  /// Get registry statistics
  DynamicRegistryStats getStats() {
    // Calculate per-app statistics
    final appStats = <String, ({int toolCount, int resourceCount})>{};

    // Count tools per app
    for (final entry in _tools.values) {
      final stats =
          appStats[entry.sourceApp] ?? (toolCount: 0, resourceCount: 0);
      appStats[entry.sourceApp] = (
        toolCount: stats.toolCount + 1,
        resourceCount: stats.resourceCount,
      );
    }

    // Count resources per app
    for (final entry in _resources.values) {
      final stats =
          appStats[entry.sourceApp] ?? (toolCount: 0, resourceCount: 0);
      appStats[entry.sourceApp] = (
        toolCount: stats.toolCount,
        resourceCount: stats.resourceCount + 1,
      );
    }

    final apps =
        appStats.entries.map((final entry) {
          final appName = entry.key;
          final stats = entry.value;
          return DynamicAppInfo(
            name: appName,
            port: _appConnections[appName] ?? 0,
            toolCount: stats.toolCount,
            resourceCount: stats.resourceCount,
            lastActivity: _appActivity[appName] ?? DateTime.now(),
          );
        }).toList();

    return DynamicRegistryStats(
      toolCount: _tools.length,
      resourceCount: _resources.length,
      appCount: _appConnections.length,
      apps: apps,
    );
  }

  /// Get tools and resources for a specific app
  ({List<DynamicToolEntry> tools, List<DynamicResourceEntry> resources})
  getAppEntries(final String sourceApp) {
    final tools =
        _tools.values
            .where((final entry) => entry.sourceApp == sourceApp)
            .toList();
    final resources =
        _resources.values
            .where((final entry) => entry.sourceApp == sourceApp)
            .toList();

    return (tools: tools, resources: resources);
  }

  /// Update app activity timestamp
  void updateAppActivity(final String sourceApp) {
    _appActivity[sourceApp] = DateTime.now();
  }

  /// Cleanup and dispose
  void dispose() {
    unawaited(_eventController.close());
    _tools.clear();
    _resources.clear();
    _appConnections.clear();
    _appActivity.clear();
  }

  @override
  String toString() =>
      'DynamicRegistry(${_tools.length} tools, '
      '${_resources.length} resources, ${_appConnections.length} apps)';
}
