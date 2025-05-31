// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:convert';

import 'package:dart_mcp/server.dart';
import 'package:flutter_inspector_mcp_server/src/services/dynamic_registry.dart';
import 'package:meta/meta.dart';

/// MCP tools for managing dynamic registry
/// These tools allow clients to interact with dynamically registered tools and resources
@immutable
final class DynamicRegistryTools {
  const DynamicRegistryTools({required this.registry});

  final DynamicRegistry registry;

  /// Tool to list all client tools and resources
  static final listClientToolsAndResources = Tool(
    name: 'listClientToolsAndResources',
    description:
        'List all dynamically registered tools and resources from Flutter clients',
    inputSchema: ObjectSchema(
      properties: {
        'includeMetadata': Schema.bool(
          description: 'Include registration metadata (default: false)',
        ),
        'filterByApp': Schema.string(
          description: 'Filter by specific app name (optional)',
        ),
      },
    ),
  );

  /// Tool to run a client tool
  static final runClientTool = Tool(
    name: 'runClientTool',
    description: 'Execute a dynamically registered tool from a Flutter client',
    inputSchema: ObjectSchema(
      required: ['toolName'],
      properties: {
        'toolName': Schema.string(description: 'Name of the tool to execute'),
        'arguments': Schema.object(
          description: 'Arguments to pass to the tool',
          additionalProperties: true,
        ),
      },
    ),
  );

  /// Tool to read a client resource
  static final runClientResource = Tool(
    name: 'runClientResource',
    description: 'Read content from a dynamically registered resource',
    inputSchema: ObjectSchema(
      required: ['resourceUri'],
      properties: {
        'resourceUri': Schema.string(
          description: 'URI of the resource to read',
        ),
      },
    ),
  );

  /// Tool to get registry statistics
  static final getRegistryStats = Tool(
    name: 'getRegistryStats',
    description: 'Get statistics about the dynamic registry',
    inputSchema: ObjectSchema(
      properties: {
        'includeAppDetails': Schema.bool(
          description: 'Include detailed app information (default: true)',
        ),
      },
    ),
  );

  /// Get all management tools
  static List<Tool> get allTools => [
    listClientToolsAndResources,
    runClientTool,
    runClientResource,
    getRegistryStats,
  ];

  /// Handle tool calls for dynamic registry management
  Future<CallToolResult> handleToolCall(
    final String toolName,
    final Map<String, Object?>? arguments,
  ) async {
    switch (toolName) {
      case 'listClientToolsAndResources':
        return _handleListClientToolsAndResources(arguments);

      case 'runClientTool':
        return _handleRunClientTool(arguments);

      case 'runClientResource':
        return _handleRunClientResource(arguments);

      case 'getRegistryStats':
        return _handleGetRegistryStats(arguments);

      default:
        return CallToolResult(
          content: [
            TextContent(text: 'Unknown dynamic registry tool: $toolName'),
          ],
          isError: true,
        );
    }
  }

  Future<CallToolResult> _handleListClientToolsAndResources(
    final Map<String, Object?>? arguments,
  ) async {
    final includeMetadata = arguments?['includeMetadata'] as bool? ?? false;
    final filterByApp = arguments?['filterByApp'] as String?;

    final toolEntries = registry.getToolEntries();
    final resourceEntries = registry.getResourceEntries();

    // Apply filtering
    final filteredTools =
        filterByApp != null
            ? toolEntries
                .where((final e) => e.sourceApp == filterByApp)
                .toList()
            : toolEntries;
    final filteredResources =
        filterByApp != null
            ? resourceEntries
                .where((final e) => e.sourceApp == filterByApp)
                .toList()
            : resourceEntries;

    final result = <String, dynamic>{
      'tools':
          filteredTools.map((final entry) {
            final toolData = <String, dynamic>{
              'name': entry.tool.name,
              'description': entry.tool.description,
              'sourceApp': entry.sourceApp,
              'dartVmPort': entry.dartVmPort,
              'registeredAt': entry.registeredAt.toIso8601String(),
            };

            if (includeMetadata) {
              toolData['metadata'] = entry.metadata;
              toolData['inputSchema'] = _schemaToMap(entry.tool.inputSchema);
            }

            return toolData;
          }).toList(),
      'resources':
          filteredResources.map((final entry) {
            final resourceData = <String, dynamic>{
              'uri': entry.resource.uri,
              'name': entry.resource.name,
              'description': entry.resource.description,
              'mimeType': entry.resource.mimeType,
              'sourceApp': entry.sourceApp,
              'dartVmPort': entry.dartVmPort,
              'registeredAt': entry.registeredAt.toIso8601String(),
            };

            if (includeMetadata) {
              resourceData['metadata'] = entry.metadata;
            }

            return resourceData;
          }).toList(),
      'summary': {
        'totalTools': filteredTools.length,
        'totalResources': filteredResources.length,
        'filteredByApp': filterByApp,
      },
    };

    return CallToolResult(
      content: [TextContent(text: jsonEncode(result))],
      isError: false,
    );
  }

  Future<CallToolResult> _handleRunClientTool(
    final Map<String, Object?>? arguments,
  ) async {
    final toolName = arguments?['toolName'] as String?;
    if (toolName == null) {
      return CallToolResult(
        content: [TextContent(text: 'Missing required parameter: toolName')],
        isError: true,
      );
    }

    final toolArguments = arguments?['arguments'] as Map<String, Object?>?;

    // Forward to the dynamic registry
    final result = await registry.forwardToolCall(toolName, toolArguments);

    if (result == null) {
      return CallToolResult(
        content: [
          TextContent(
            text:
                'Tool not found: $toolName. '
                'Use listClientToolsAndResources to see available tools.',
          ),
        ],
        isError: true,
      );
    }

    return result;
  }

  Future<CallToolResult> _handleRunClientResource(
    final Map<String, Object?>? arguments,
  ) async {
    final resourceUri = arguments?['resourceUri'] as String?;
    if (resourceUri == null) {
      return CallToolResult(
        content: [TextContent(text: 'Missing required parameter: resourceUri')],
        isError: true,
      );
    }

    // Forward to the dynamic registry
    final content = await registry.forwardResourceRead(resourceUri);

    if (content == null) {
      return CallToolResult(
        content: [
          TextContent(
            text:
                'Resource not found: $resourceUri. '
                'Use listClientToolsAndResources to see available resources.',
          ),
        ],
        isError: true,
      );
    }

    return CallToolResult(content: content, isError: false);
  }

  Future<CallToolResult> _handleGetRegistryStats(
    final Map<String, Object?>? arguments,
  ) async {
    final includeAppDetails = arguments?['includeAppDetails'] as bool? ?? true;
    final stats = registry.getStats();

    final result = <String, dynamic>{
      'toolCount': stats.toolCount,
      'resourceCount': stats.resourceCount,
      'appCount': stats.appCount,
    };

    if (includeAppDetails) {
      result['apps'] =
          stats.apps
              .map(
                (final app) => {
                  'name': app.name,
                  'port': app.port,
                  'toolCount': app.toolCount,
                  'resourceCount': app.resourceCount,
                  'lastActivity': app.lastActivity.toIso8601String(),
                },
              )
              .toList();
    }

    return CallToolResult(
      content: [TextContent(text: jsonEncode(result))],
      isError: false,
    );
  }

  /// Convert ObjectSchema to a map for JSON serialization
  /// Handle this carefully since ObjectSchema is an extension type
  Map<String, dynamic> _schemaToMap(final ObjectSchema schema) {
    // Since ObjectSchema is an extension type, we'll create a simplified representation
    try {
      return {
        'type': 'object',
        'description': schema.description,
        'title': schema.title,
        'required': schema.required,
        // Note: We can't easily access all properties without reflection
        // This is a simplified representation for JSON output
      };
    } catch (e) {
      // Fallback if access fails
      return {
        'type': 'object',
        'description': 'Schema serialization not available',
      };
    }
  }
}
