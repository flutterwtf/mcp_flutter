// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

// ignore_for_file: lines_longer_than_80_chars

import 'dart:convert';

import 'package:dart_mcp/server.dart';
import 'package:flutter_inspector_mcp_server/src/dynamic_registry/dynamic_registry.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
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
    final includeMetadata = jsonDecodeBool(arguments?['includeMetadata']);

    // TODO(arenuvern): verify Dart VM connection.
    // make sure, the registry is requested tools and resources
    // from the Dart VM.

    final toolEntries = registry.getToolEntries();
    final resourceEntries = registry.getResourceEntries();

    final result = <String, dynamic>{
      'tools':
          toolEntries.map((final entry) {
            final toolData = <String, dynamic>{
              ...entry.tool as Map<String, dynamic>,
              if (includeMetadata) ...{
                'metadata': entry.metadata,
                'inputSchema': _schemaToMap(entry.tool.inputSchema),
                'dartVmPort': entry.dartVmPort,
                'registeredAt': entry.registeredAt.toIso8601String(),
              },
            };

            return toolData;
          }).toList(),
      'resources':
          resourceEntries.map((final entry) {
            final resourceData = <String, dynamic>{
              ...entry.resource as Map<String, dynamic>,
              if (includeMetadata) ...{
                'metadata': entry.metadata,
                'dartVmPort': entry.dartVmPort,
                'registeredAt': entry.registeredAt.toIso8601String(),
              },
            };

            return resourceData;
          }).toList(),
      'summary': {
        'totalTools': toolEntries.length,
        'totalResources': resourceEntries.length,
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
    final toolName = jsonDecodeString(arguments?['toolName']);
    if (toolName.isEmpty) {
      return CallToolResult(
        content: [TextContent(text: 'Missing required parameter: toolName')],
        isError: true,
      );
    }

    final toolArguments = jsonDecodeMapAs<String, Object?>(
      arguments?['arguments'],
    );

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
    final resourceUri = jsonDecodeString(arguments?['resourceUri']);
    if (resourceUri.isEmpty) {
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

    return CallToolResult(
      content: content.contents.map((final c) => c.toContent()).toList(),
      isError: false,
    );
  }

  Future<CallToolResult> _handleGetRegistryStats(
    final Map<String, Object?>? arguments,
  ) async {
    final includeAppDetails = jsonDecodeBool(arguments?['includeAppDetails']);
    final stats = registry.getStats();

    final result = <String, dynamic>{
      'toolCount': stats.toolCount,
      'resourceCount': stats.resourceCount,
      if (includeAppDetails) ...stats.app,
    };

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
      return {'type': 'object', ...schema as Map};
    } on Exception catch (e, stackTrace) {
      // Fallback if access fails
      return {
        'type': 'object',
        'description': 'Schema serialization not available',
        'error': e.toString(),
        'stackTrace': stackTrace.toString(),
      };
    }
  }
}

extension on ResourceContents {
  Content toContent() {
    final mimeType = this.mimeType;
    if (mimeType == null ||
        mimeType.startsWith('text/') ||
        mimeType.startsWith('application/')) {
      final textContent = this as TextResourceContents;
      return TextContent(text: textContent.text);
    } else if (mimeType.startsWith('image/')) {
      return ImageContent(
        data: (this as BlobResourceContents).blob,
        mimeType: mimeType,
      );
    } else if (mimeType.startsWith('audio/')) {
      return AudioContent(
        data: (this as BlobResourceContents).blob,
        mimeType: mimeType,
      );
    } else {
      return TextContent(text: 'Unsupported resource contents type: $this');
    }
  }
}
