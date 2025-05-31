// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:async';

import 'package:dart_mcp/server.dart';
import 'package:flutter_inspector_mcp_server/src/base_server.dart';
import 'package:flutter_inspector_mcp_server/src/services/dynamic_registry.dart';
import 'package:flutter_inspector_mcp_server/src/services/dynamic_registry_tools.dart';
import 'package:meta/meta.dart';

/// Mixin that integrates dynamic registry with MCP server infrastructure
/// Provides seamless handling of both static and dynamic tools/resources
/// Works by wrapping the standard MCP tool/resource registration system
base mixin DynamicRegistryIntegration on BaseMCPToolkitServer {
  @protected
  late final DynamicRegistry _dynamicRegistry;

  @protected
  late final DynamicRegistryTools _dynamicRegistryTools;

  bool get _dynamicRegistrySupported => configuration.dynamicRegistrySupported;

  /// Initialize the dynamic registry integration
  @protected
  void initializeDynamicRegistry() {
    _dynamicRegistry = DynamicRegistry(logger: this);
    _dynamicRegistryTools = DynamicRegistryTools(registry: _dynamicRegistry);

    log(
      LoggingLevel.info,
      'Dynamic registry integration initialized',
      logger: 'DynamicRegistryIntegration',
    );

    // Listen to registry events for debugging/monitoring
    _dynamicRegistry.events.listen(_logRegistryEvent);
  }

  /// Override initialize to register dynamic registry management tools
  @override
  FutureOr<InitializeResult> initialize(final InitializeRequest request) async {
    if (_dynamicRegistrySupported) {
      // Register the dynamic registry management tools using standard MCP approach
      _registerDynamicRegistryTools();
    }

    return super.initialize(request);
  }

  /// Dispose dynamic registry resources
  @protected
  void disposeDynamicRegistry() {
    if (_dynamicRegistrySupported) {
      _dynamicRegistry.dispose();
      log(
        LoggingLevel.info,
        'Dynamic registry disposed',
        logger: 'DynamicRegistryIntegration',
      );
    }
  }

  /// Register the dynamic registry management tools
  void _registerDynamicRegistryTools() {
    for (final tool in DynamicRegistryTools.allTools) {
      try {
        if (this case final ToolsSupport toolsSupport) {
          toolsSupport.registerTool(
            tool,
            (final request) async => _dynamicRegistryTools.handleToolCall(
              request.name,
              request.arguments,
            ),
          );
        }
      } catch (e) {
        log(
          LoggingLevel.warning,
          'Failed to register dynamic registry tool ${tool.name}: $e',
          logger: 'DynamicRegistryIntegration',
        );
      }
    }
  }

  /// Register a dynamic tool from a Flutter client
  /// This creates a wrapper that forwards calls to the dynamic registry
  @protected
  void registerDynamicTool(
    final Tool tool,
    final String sourceApp,
    final int dartVmPort, {
    final Map<String, dynamic> metadata = const {},
  }) {
    if (!_dynamicRegistrySupported) {
      log(
        LoggingLevel.warning,
        'Attempted to register dynamic tool but registry is disabled',
        logger: 'DynamicRegistryIntegration',
      );
      return;
    }

    // Register in the dynamic registry
    _dynamicRegistry.registerTool(
      tool,
      sourceApp,
      dartVmPort,
      metadata: metadata,
    );

    // Register as a standard MCP tool that forwards to the dynamic registry
    if (this case final ToolsSupport toolsSupport) {
      try {
        toolsSupport.registerTool(
          tool,
          (final request) async =>
              await _dynamicRegistry.forwardToolCall(
                request.name,
                request.arguments,
              ) ??
              CallToolResult(
                content: [
                  TextContent(
                    text: 'Dynamic tool not available: ${request.name}',
                  ),
                ],
                isError: true,
              ),
        );

        log(
          LoggingLevel.info,
          'Registered dynamic tool as MCP tool: ${tool.name}',
          logger: 'DynamicRegistryIntegration',
        );
      } catch (e) {
        log(
          LoggingLevel.warning,
          'Failed to register dynamic tool ${tool.name} as MCP tool: $e',
          logger: 'DynamicRegistryIntegration',
        );
      }
    }
  }

  /// Register a dynamic resource from a Flutter client
  /// This creates a wrapper that forwards calls to the dynamic registry
  @protected
  void registerDynamicResource(
    final Resource resource,
    final String sourceApp,
    final int dartVmPort, {
    final Map<String, dynamic> metadata = const {},
  }) {
    if (!_dynamicRegistrySupported) {
      log(
        LoggingLevel.warning,
        'Attempted to register dynamic resource but registry is disabled',
        logger: 'DynamicRegistryIntegration',
      );
      return;
    }

    // Register in the dynamic registry
    _dynamicRegistry.registerResource(
      resource,
      sourceApp,
      dartVmPort,
      metadata: metadata,
    );

    // Register as a standard MCP resource that forwards to the dynamic registry
    if (this case final ResourcesSupport resourcesSupport) {
      try {
        resourcesSupport.addResource(resource, (final request) async {
          final content = await _dynamicRegistry.forwardResourceRead(
            request.uri,
          );
          if (content != null) {
            return ReadResourceResult(
              contents:
                  content
                      .map(
                        (final c) =>
                            c is TextContent
                                ? TextResourceContents(
                                  uri: request.uri,
                                  text: c.text,
                                  mimeType: 'text/plain',
                                )
                                : BlobResourceContents(
                                  uri: request.uri,
                                  blob: '',
                                  mimeType: 'application/octet-stream',
                                ),
                      )
                      .toList(),
            );
          }

          return ReadResourceResult(
            contents: [
              TextResourceContents(
                uri: request.uri,
                text: 'Dynamic resource not available: ${request.uri}',
              ),
            ],
          );
        });

        log(
          LoggingLevel.info,
          'Registered dynamic resource as MCP resource: ${resource.uri}',
          logger: 'DynamicRegistryIntegration',
        );
      } catch (e) {
        log(
          LoggingLevel.warning,
          'Failed to register dynamic resource ${resource.uri} as MCP resource: $e',
          logger: 'DynamicRegistryIntegration',
        );
      }
    }
  }

  /// Unregister all tools and resources from a Flutter client
  @protected
  void unregisterDynamicApp(final String sourceApp) {
    if (!_dynamicRegistrySupported) return;

    final hadContent = _dynamicRegistry.getAppEntries(sourceApp);

    // Unregister from MCP framework first
    if (this case final ToolsSupport toolsSupport) {
      for (final entry in hadContent.tools) {
        try {
          toolsSupport.unregisterTool(entry.tool.name);
        } catch (e) {
          log(
            LoggingLevel.warning,
            'Failed to unregister MCP tool ${entry.tool.name}: $e',
            logger: 'DynamicRegistryIntegration',
          );
        }
      }
    }

    if (this case final ResourcesSupport resourcesSupport) {
      for (final entry in hadContent.resources) {
        try {
          resourcesSupport.removeResource(entry.resource.uri);
        } catch (e) {
          log(
            LoggingLevel.warning,
            'Failed to unregister MCP resource ${entry.resource.uri}: $e',
            logger: 'DynamicRegistryIntegration',
          );
        }
      }
    }

    // Then unregister from dynamic registry
    if (hadContent.tools.isNotEmpty || hadContent.resources.isNotEmpty) {
      _dynamicRegistry.unregisterApp(sourceApp);
    }
  }

  /// Get dynamic registry statistics
  @protected
  DynamicRegistryStats? getDynamicRegistryStats() {
    if (!_dynamicRegistrySupported) return null;
    return _dynamicRegistry.getStats();
  }

  /// Check if dynamic registry is enabled
  @protected
  bool get isDynamicRegistryEnabled => _dynamicRegistrySupported;

  /// Get the dynamic registry instance (for advanced usage)
  @protected
  DynamicRegistry? get dynamicRegistry =>
      _dynamicRegistrySupported ? _dynamicRegistry : null;

  void _logRegistryEvent(final DynamicRegistryEvent event) {
    switch (event) {
      case ToolRegisteredEvent(:final entry):
        log(
          LoggingLevel.debug,
          'Dynamic tool registered: ${entry.tool.name} from ${entry.sourceApp}',
          logger: 'DynamicRegistryIntegration',
        );

      case ToolUnregisteredEvent(:final toolName, :final sourceApp):
        log(
          LoggingLevel.debug,
          'Dynamic tool unregistered: $toolName from $sourceApp',
          logger: 'DynamicRegistryIntegration',
        );

      case ResourceRegisteredEvent(:final entry):
        log(
          LoggingLevel.debug,
          'Dynamic resource registered: ${entry.resource.uri} from ${entry.sourceApp}',
          logger: 'DynamicRegistryIntegration',
        );

      case ResourceUnregisteredEvent(:final resourceUri, :final sourceApp):
        log(
          LoggingLevel.debug,
          'Dynamic resource unregistered: $resourceUri from $sourceApp',
          logger: 'DynamicRegistryIntegration',
        );

      case AppUnregisteredEvent(
        :final sourceApp,
        :final toolsRemoved,
        :final resourcesRemoved,
      ):
        log(
          LoggingLevel.info,
          'Dynamic app unregistered: $sourceApp ($toolsRemoved tools, $resourcesRemoved resources)',
          logger: 'DynamicRegistryIntegration',
        );
    }
  }
}
