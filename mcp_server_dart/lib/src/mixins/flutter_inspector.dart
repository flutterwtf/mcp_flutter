// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

// ignore_for_file: avoid_catches_without_on_clauses, lines_longer_than_80_chars

import 'dart:async';
import 'dart:convert';

import 'package:dart_mcp/server.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:meta/meta.dart';
import 'package:vm_service/vm_service.dart';

import 'vm_service_support.dart';

/// Mix this in to any MCPServer to add Flutter Inspector functionality.
base mixin FlutterInspector
    on ToolsSupport, ResourcesSupport, VMServiceSupport {
  @override
  FutureOr<InitializeResult> initialize(final InitializeRequest request) {
    // Register tools
    registerTool(hotReloadTool, _hotReload);
    registerTool(getVmTool, _getVm);
    registerTool(getExtensionRpcsTool, _getExtensionRpcs);
    registerTool(testCustomExtTool, _testCustomExt);

    // Register resources if supported
    final server = this as VMServiceConfiguration;
    if (server.enableResources) {
      _registerResources();
    }

    return super.initialize(request);
  }

  /// Call a Flutter extension method
  Future<Response> callFlutterExtension(
    final String method,
    final Map<String, dynamic> args,
  ) async {
    final isolate = await getMainIsolate();
    if (isolate?.id == null) {
      throw StateError('No isolate found');
    }

    final response = await callServiceExtension(
      method,
      isolateId: isolate!.id,
      args: args,
    );

    if (response == null) {
      throw StateError('Extension call returned null');
    }

    return response;
  }

  /// Register resources for widget tree, screenshots, and app errors.
  void _registerResources() {
    final server = this as VMServiceConfiguration;

    // App errors resource
    final appErrorsResource = Resource(
      uri: 'visual://localhost/app/errors/latest',
      name: 'Latest Application Error',
      description: 'Get the most recent application error from Dart VM',
    );
    addResource(appErrorsResource, _handleAppErrorsResource);

    // Screenshots resource (if images supported)
    if (server.enableImages) {
      final screenshotsResource = Resource(
        uri: 'visual://localhost/view/screenshots',
        name: 'Screenshots',
        description:
            'Get screenshots of all views in the application. Returns base64 encoded images.',
      );
      addResource(screenshotsResource, _handleScreenshotsResource);
    }

    // View details resource
    final viewDetailsResource = Resource(
      uri: 'visual://localhost/view/details',
      name: 'View Details',
      description: 'Get details for all views in the application.',
    );
    addResource(viewDetailsResource, _handleViewDetailsResource);
  }

  /// Hot reload the Flutter application.
  Future<CallToolResult> _hotReload(final CallToolRequest request) async {
    try {
      final result = await hotReload(
        force: jsonDecodeBool(request.arguments?['force']),
      );

      return CallToolResult(
        content: [
          TextContent(text: 'Hot reload completed: ${jsonEncode(result)}'),
        ],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Hot reload failed: $e')],
      );
    }
  }

  /// Get VM information.
  Future<CallToolResult> _getVm(final CallToolRequest request) async {
    try {
      if (vmService == null) {
        return CallToolResult(
          isError: true,
          content: [TextContent(text: 'VM service not connected')],
        );
      }

      final vm = await vmService!.getVM();

      return CallToolResult(
        content: [TextContent(text: jsonEncode(vm.toJson()))],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Failed to get VM info: $e')],
      );
    }
  }

  /// Get available extension RPCs.
  Future<CallToolResult> _getExtensionRpcs(
    final CallToolRequest request,
  ) async {
    try {
      if (vmService == null) {
        return CallToolResult(
          isError: true,
          content: [TextContent(text: 'VM service not connected')],
        );
      }

      final vm = await vmService!.getVM();
      final allExtensions = <String>[];

      for (final isolateRef in vm.isolates ?? <IsolateRef>[]) {
        final isolate = await vmService!.getIsolate(isolateRef.id!);
        if (isolate.extensionRPCs != null) {
          allExtensions.addAll(isolate.extensionRPCs!);
        }
      }

      return CallToolResult(
        content: [
          TextContent(text: jsonEncode(allExtensions.toSet().toList())),
        ],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Failed to get extension RPCs: $e')],
      );
    }
  }

  /// Test custom extension.
  Future<CallToolResult> _testCustomExt(final CallToolRequest request) async {
    try {
      final result = await callFlutterExtension('ext.mcp.toolkit.app_errors', {
        'count': 10,
      });

      return CallToolResult(
        content: [TextContent(text: jsonEncode(result.json))],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Test custom extension failed: $e')],
      );
    }
  }

  /// Handle app errors resource request.
  Future<ReadResourceResult> _handleAppErrorsResource(
    final ReadResourceRequest request,
  ) async {
    try {
      final result = await callFlutterExtension('ext.mcp.toolkit.app_errors', {
        'count': 4,
      });

      final errors = result.json?['errors'] as List? ?? [];
      final message = result.json?['message'] as String? ?? 'No errors found';

      if (errors.isEmpty) {
        return ReadResourceResult(
          contents: [TextResourceContents(uri: request.uri, text: message)],
        );
      }

      return ReadResourceResult(
        contents: [
          TextResourceContents(
            uri: request.uri,
            text: '$message\n${jsonEncode(errors)}',
          ),
        ],
      );
    } catch (e) {
      return ReadResourceResult(
        contents: [
          TextResourceContents(
            uri: request.uri,
            text: 'Failed to get app errors: $e',
          ),
        ],
      );
    }
  }

  /// Handle screenshots resource request.
  Future<ReadResourceResult> _handleScreenshotsResource(
    final ReadResourceRequest request,
  ) async {
    try {
      final result = await callFlutterExtension(
        'ext.mcp.toolkit.view_screenshots',
        {'compress': true},
      );

      final images = result.json?['images'] as List? ?? [];

      return ReadResourceResult(
        contents:
            images
                .map(
                  (final image) => BlobResourceContents(
                    uri: request.uri,
                    blob: image as String,
                    mimeType: 'image/png',
                  ),
                )
                .toList(),
      );
    } catch (e) {
      return ReadResourceResult(
        contents: [
          TextResourceContents(
            uri: request.uri,
            text: 'Failed to get screenshots: $e',
          ),
        ],
      );
    }
  }

  /// Handle view details resource request.
  Future<ReadResourceResult> _handleViewDetailsResource(
    final ReadResourceRequest request,
  ) async {
    try {
      final result = await callFlutterExtension(
        'ext.mcp.toolkit.view_details',
        {},
      );

      final details = result.json?['details'] ?? {};
      final message = result.json?['message'] as String? ?? 'View details';

      return ReadResourceResult(
        contents: [
          TextResourceContents(
            uri: request.uri,
            text: '$message\n${jsonEncode(details)}',
          ),
        ],
      );
    } catch (e) {
      return ReadResourceResult(
        contents: [
          TextResourceContents(
            uri: request.uri,
            text: 'Failed to get view details: $e',
          ),
        ],
      );
    }
  }

  // Tool definitions
  @visibleForTesting
  static final hotReloadTool = Tool(
    name: 'hot_reload_flutter',
    description: 'Hot reloads the Flutter app.',
    inputSchema: Schema.object(
      properties: {
        'port': Schema.int(
          description:
              'Optional: Custom port number if not using default Flutter debug port 8181',
        ),
        'force': Schema.bool(
          description:
              'If true, forces a hot reload even if there are no changes to the source code',
        ),
      },
    ),
  );

  @visibleForTesting
  static final getVmTool = Tool(
    name: 'get_vm',
    description:
        'Utility: Get VM information from a Flutter app. This is a VM service method, not a Flutter RPC.',
    inputSchema: Schema.object(
      properties: {
        'port': Schema.int(
          description:
              'Optional: Custom port number if not using default Flutter debug port 8181',
        ),
      },
    ),
  );

  @visibleForTesting
  static final getExtensionRpcsTool = Tool(
    name: 'get_extension_rpcs',
    description:
        'Utility: List all available extension RPCs in the Flutter app.',
    inputSchema: Schema.object(
      properties: {
        'port': Schema.int(
          description:
              'Optional: Custom port number if not using default Flutter debug port 8181',
        ),
        'isolateId': Schema.string(
          description:
              'Optional specific isolate ID to check. If not provided, checks all isolates',
        ),
        'isRawResponse': Schema.bool(
          description:
              'If true, returns the raw response from the VM service without processing',
        ),
      },
    ),
  );

  @visibleForTesting
  static final testCustomExtTool = Tool(
    name: 'test_custom_ext',
    description:
        'Utility: Test the custom extension. This is a helper tool for testing the custom extension.',
    inputSchema: Schema.object(
      properties: {
        'port': Schema.int(
          description:
              'Optional: Custom port number if not using default Flutter debug port 8181',
        ),
      },
    ),
  );
}
