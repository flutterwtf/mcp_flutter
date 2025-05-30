// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

// ignore_for_file: avoid_catches_without_on_clauses, lines_longer_than_80_chars

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dart_mcp/server.dart';
import 'package:flutter_inspector_mcp_server/src/mixins/vm_service_support.dart';
import 'package:flutter_inspector_mcp_server/src/server.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:is_dart_empty_or_not/is_dart_empty_or_not.dart';
import 'package:meta/meta.dart';
import 'package:vm_service/vm_service.dart';

/// Mix this in to any MCPServer to add Flutter Inspector functionality.
base mixin FlutterInspector
    on BaseMCPToolkitServer, ToolsSupport, ResourcesSupport, VMServiceSupport {
  @override
  FutureOr<InitializeResult> initialize(final InitializeRequest request) {
    // Register core tools
    registerTool(hotReloadTool, _hotReload);
    registerTool(getVmTool, _getVm);
    registerTool(getExtensionRpcsTool, _getExtensionRpcs);
    registerTool(getActivePortsTool, _getActivePorts);

    // Register debug dump tools
    if (configuration.dumpsSupported) {
      registerTool(debugDumpLayerTreeTool, _debugDumpLayerTree);
      registerTool(debugDumpSemanticsTreeTool, _debugDumpSemanticsTree);
      registerTool(debugDumpRenderTreeTool, _debugDumpRenderTree);
      registerTool(debugDumpFocusTreeTool, _debugDumpFocusTree);
    }

    // Smart registration: Resources OR Tools (not both)
    if (configuration.resourcesSupported) {
      // Register as resources (existing behavior)
      _registerResources();
    } else {
      // Register as tools instead
      _registerResourcesAsTools();
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
    // App errors resource
    final latestAppErrorSrc = Resource(
      uri: 'visual://localhost/app/errors/latest',
      name: 'Latest Application Error',
      mimeType: 'application/json',
      description: 'Get the most recent application error from Dart VM',
    );
    addResource(latestAppErrorSrc, _handleAppLatestErrorResource);

    // App errors resource
    final appErrorsResource = ResourceTemplate(
      uriTemplate: 'visual://localhost/app/errors/{count}',
      name: 'Application Errors',
      mimeType: 'application/json',
      description:
          'Get a specified number of latest application errors from Dart VM. Limit to 4 or fewer for performance.',
    );
    addResourceTemplate(appErrorsResource, _handleAppErrorsResource);

    // Screenshots resource (if images supported)
    if (configuration.imagesSupported) {
      final screenshotsResource = Resource(
        uri: 'visual://localhost/view/screenshots',
        name: 'Screenshots',
        mimeType: 'image/png',
        description:
            'Get screenshots of all views in the application. Returns base64 encoded images.',
      );
      addResource(screenshotsResource, _handleScreenshotsResource);
    }

    // View details resource
    final viewDetailsResource = Resource(
      uri: 'visual://localhost/view/details',
      name: 'View Details',
      mimeType: 'application/json',
      description: 'Get details for all views in the application.',
    );
    addResource(viewDetailsResource, _handleViewDetailsResource);
  }

  /// Hot reload the Flutter application.
  Future<CallToolResult> _hotReload(final CallToolRequest request) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }
    try {
      final result = await hotReload(
        force: jsonDecodeBool(request.arguments?['force']),
      );

      return CallToolResult(
        content: [
          TextContent(text: 'Hot reload completed'),
          TextContent(text: jsonEncode(result)),
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
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }
    try {
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
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }
    try {
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

  Future<ReadResourceResult> _handleAppLatestErrorResource(
    final ReadResourceRequest request,
  ) => _handleAppErrorsResource(request, count: 1);

  /// Handle app errors resource request.
  Future<ReadResourceResult> _handleAppErrorsResource(
    final ReadResourceRequest request, {
    final int count = 4,
  }) async {
    try {
      final parsedCount = Uri.parse(request.uri).pathSegments.last;
      final result = await callFlutterExtension('ext.mcp.toolkit.app_errors', {
        'count': jsonDecodeInt(parsedCount).whenZeroUse(count),
      });
      final json = result.json;
      if (json == null) {
        return ReadResourceResult(
          contents: [
            TextResourceContents(uri: request.uri, text: 'No errors found'),
          ],
        );
      }
      final errors = jsonDecodeListAs<Map<String, dynamic>>(json['errors']);
      final message = jsonDecodeString(
        json['message'],
      ).whenEmptyUse('No errors found');

      if (errors.isEmpty) {
        return ReadResourceResult(
          contents: [TextResourceContents(uri: request.uri, text: message)],
        );
      }

      return ReadResourceResult(
        contents: [
          TextResourceContents(uri: request.uri, text: message),
          ...errors.map(
            (final error) => TextResourceContents(
              uri: request.uri,
              text: jsonEncode(error),
              mimeType: 'application/json',
            ),
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

      final images = jsonDecodeListAs<String>(result.json?['images']);

      return ReadResourceResult(
        contents:
            images
                .map(
                  (final image) => BlobResourceContents(
                    uri: request.uri,
                    blob: image,
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

      final details = jsonDecodeListAs<Map<String, dynamic>>(
        result.json?['details'],
      );
      final message = jsonDecodeString(
        result.json?['message'],
      ).whenEmptyUse('View details');

      return ReadResourceResult(
        contents: [
          TextResourceContents(uri: request.uri, text: message),
          ...details.map(
            (final detail) => TextResourceContents(
              uri: request.uri,
              text: jsonEncode(detail),
              mimeType: 'application/json',
            ),
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
  static final debugDumpLayerTreeTool = Tool(
    name: 'debug_dump_layer_tree',
    description: 'Dumps the layer tree of the Flutter app.',
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
  static final debugDumpSemanticsTreeTool = Tool(
    name: 'debug_dump_semantics_tree',
    description: 'Dumps the semantics tree of the Flutter app.',
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
  static final debugDumpRenderTreeTool = Tool(
    name: 'debug_dump_render_tree',
    description: 'Dumps the render tree of the Flutter app.',
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
  static final debugDumpFocusTreeTool = Tool(
    name: 'debug_dump_focus_tree',
    description: 'Dumps the focus tree of the Flutter app.',
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
  static final getActivePortsTool = Tool(
    name: 'get_active_ports',
    description: 'Gets the active ports of the Flutter app.',
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
  static final getAppErrorsTool = Tool(
    name: 'get_app_errors',
    description: 'Get the most recent application errors from Dart VM',
    inputSchema: Schema.object(
      properties: {
        'count': Schema.int(
          description: 'Number of recent errors to retrieve (default: 4)',
        ),
      },
    ),
  );

  @visibleForTesting
  static final getScreenshotsTool = Tool(
    name: 'get_screenshots',
    description: 'Get screenshots of all views in the application',
    inputSchema: Schema.object(
      properties: {
        'compress': Schema.bool(
          description: 'Whether to compress the images (default: true)',
        ),
      },
    ),
  );

  @visibleForTesting
  static final getViewDetailsTool = Tool(
    name: 'get_view_details',
    description: 'Get details for all views in the application',
    inputSchema: Schema.object(properties: {}),
  );

  /// Debug dump layer tree.
  Future<CallToolResult> _debugDumpLayerTree(
    final CallToolRequest request,
  ) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }

    try {
      final result = await callFlutterExtension(
        'ext.flutter.debugDumpLayerTree',
        {},
      );
      return CallToolResult(
        content: [TextContent(text: jsonEncode(result.json))],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Debug dump layer tree failed: $e')],
      );
    }
  }

  /// Debug dump semantics tree.
  Future<CallToolResult> _debugDumpSemanticsTree(
    final CallToolRequest request,
  ) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }

    try {
      final result = await callFlutterExtension(
        'ext.flutter.debugDumpSemanticsTreeInTraversalOrder',
        {},
      );
      return CallToolResult(
        content: [TextContent(text: jsonEncode(result.json))],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Debug dump semantics tree failed: $e')],
      );
    }
  }

  /// Debug dump render tree.
  Future<CallToolResult> _debugDumpRenderTree(
    final CallToolRequest request,
  ) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }

    try {
      final result = await callFlutterExtension(
        'ext.flutter.debugDumpRenderTree',
        {},
      );
      return CallToolResult(
        content: [TextContent(text: jsonEncode(result.json))],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Debug dump render tree failed: $e')],
      );
    }
  }

  /// Debug dump focus tree.
  Future<CallToolResult> _debugDumpFocusTree(
    final CallToolRequest request,
  ) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }

    try {
      final result = await callFlutterExtension(
        'ext.flutter.debugDumpFocusTree',
        {},
      );
      return CallToolResult(
        content: [TextContent(text: jsonEncode(result.json))],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Debug dump focus tree failed: $e')],
      );
    }
  }

  /// Get active ports.
  Future<CallToolResult> _getActivePorts(final CallToolRequest request) async {
    try {
      // Implement port scanning logic
      final ports = await _scanForFlutterPorts();
      return CallToolResult(content: [TextContent(text: jsonEncode(ports))]);
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Failed to get active ports: $e')],
      );
    }
  }

  /// Scan for ports where Flutter/Dart processes are listening
  Future<List<int>> _scanForFlutterPorts() async {
    final activePorts = <int>[];
    final result = await Process.run('lsof', ['-i', '-P', '-n']);
    final stdout = jsonDecodeString(result.stdout);
    final lines = stdout.split('\n');

    for (final line in lines) {
      if (line.toLowerCase().contains('dart') ||
          line.toLowerCase().contains('flutter')) {
        final parts = line.split(RegExp(r'\s+'));
        if (parts.length < 9) continue;
        final addressPart = parts[8];
        final portMatch = RegExp(r':(\d+)$').firstMatch(addressPart);
        if (portMatch == null) continue;
        final port = jsonDecodeInt(portMatch.group(1));
        if (port.isZero) continue;
        activePorts.add(port);
      }
    }

    return activePorts.toSet().toList();
  }

  /// Register resource functionality as tools when resources not supported
  void _registerResourcesAsTools() {
    // Always register app errors tool
    registerTool(getAppErrorsTool, _getAppErrors);

    // Register screenshots tool if images supported
    if (configuration.imagesSupported) {
      registerTool(getScreenshotsTool, _getScreenshots);
    }

    // Always register view details tool
    registerTool(getViewDetailsTool, _getViewDetails);
  }

  /// Get app errors as tool.
  Future<CallToolResult> _getAppErrors(final CallToolRequest request) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }

    try {
      final count = jsonDecodeInt(request.arguments?['count']).whenZeroUse(4);
      final result = await callFlutterExtension('ext.mcp.toolkit.app_errors', {
        'count': count,
      });

      final errors = jsonDecodeListAs<Map<String, dynamic>>(
        result.json?['errors'],
      );
      final message = jsonDecodeString(
        result.json?['message'],
      ).whenEmptyUse('No errors found');

      return CallToolResult(
        content: [
          TextContent(text: message),
          ...errors.map((final error) => TextContent(text: jsonEncode(error))),
        ],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Failed to get app errors: $e')],
      );
    }
  }

  /// Get screenshots as tool.
  Future<CallToolResult> _getScreenshots(final CallToolRequest request) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }

    try {
      final compress =
          bool.tryParse('${request.arguments?['compress']}') ?? true;
      final result = await callFlutterExtension(
        'ext.mcp.toolkit.view_screenshots',
        {'compress': compress},
      );

      final images = jsonDecodeListAs<String>(result.json?['images']);

      return CallToolResult(
        content: [
          ...images.map(
            (final image) => ImageContent(data: image, mimeType: 'image/png'),
          ),
        ],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Failed to get screenshots: $e')],
      );
    }
  }

  /// Get view details as tool.
  Future<CallToolResult> _getViewDetails(final CallToolRequest request) async {
    final connected = await ensureVMServiceConnected();
    if (!connected) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'VM service not connected')],
      );
    }

    try {
      final result = await callFlutterExtension(
        'ext.mcp.toolkit.view_details',
        {},
      );
      final details = jsonDecodeListAs<Map<String, dynamic>>(
        result.json?['details'],
      );
      final message = jsonDecodeString(
        result.json?['message'],
      ).whenEmptyUse('View details');

      return CallToolResult(
        content: [
          TextContent(text: message),
          ...details.map(
            (final detail) => TextContent(text: jsonEncode(detail)),
          ),
        ],
      );
    } catch (e) {
      return CallToolResult(
        isError: true,
        content: [TextContent(text: 'Failed to get view details: $e')],
      );
    }
  }
}
