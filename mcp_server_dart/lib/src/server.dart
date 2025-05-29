// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:async';

import 'package:dart_mcp/server.dart';
import 'package:stream_channel/stream_channel.dart';

import 'mixins/flutter_inspector.dart';
import 'mixins/vm_service_support.dart';

/// Flutter Inspector MCP Server
///
/// Provides tools and resources for Flutter app inspection and debugging
final class FlutterInspectorMCPServer extends MCPServer
    with ToolsSupport, ResourcesSupport, VMServiceSupport, FlutterInspector
    implements VMServiceConfiguration {
  FlutterInspectorMCPServer.fromStreamChannel(
    super.channel, {
    required this.vmHost,
    required this.vmPort,
    required this.enableResources,
    required this.enableImages,
    required this.dumpsSupported,
    required this.logLevel,
    required this.environment,
  }) : super.fromStreamChannel(
         implementation: ServerImplementation(
           name: 'flutter-inspector',
           version: '1.0.0',
         ),
         instructions: '''
Flutter Inspector MCP Server

This server provides tools and resources for inspecting and debugging Flutter applications.

Available tools:
- hot_reload_flutter: Hot reload the Flutter app
- get_vm: Get VM information
- get_extension_rpcs: List available extension RPCs

${dumpsSupported ? '''
- debug_dump_layer_tree: Dump layer tree (WARNING: Heavy operation)
- debug_dump_semantics_tree: Dump semantics tree (WARNING: Heavy operation)
- debug_dump_semantics_tree_inverse: Dump semantics tree in inverse order (WARNING: Heavy operation)
- debug_dump_render_tree: Dump render tree
- debug_dump_focus_tree: Dump focus tree
- get_active_ports: Get list of Flutter/Dart process ports
''' : ''}

${enableResources ? '''
Available resources:
- visual://localhost/app/errors/latest: Get latest app errors
- visual://localhost/app/errors/{count}: Get certain number of app errors
- visual://localhost/view/details: Get views details
- visual://localhost/view/screenshots: Get views screenshots

''' : '''

Available tools:
- get_view_errors: Get view errors
- get_view_details: Get view details
- get_screenshots: Get screenshots

'''}

Connect to a running Flutter app on debug mode to use these features.
          ''',
       );

  @override
  final String vmHost;
  @override
  final int vmPort;
  @override
  final bool enableResources;
  @override
  final bool enableImages;
  @override
  final bool dumpsSupported;
  @override
  final String logLevel;
  @override
  final String environment;

  @override
  FutureOr<InitializeResult> initialize(final InitializeRequest request) async {
    // Call parent initialize first which will trigger the mixin's initialize
    // This registers tools and resources regardless of VM service connection
    final result = await super.initialize(request);

    // Try to initialize VM service connection (non-blocking)
    // This allows tools to be available even if no Flutter app is running
    unawaited(
      _initializeVMServiceAsync()
          .then((_) {
            // VM service connected successfully
          })
          .catchError((final e, final s) {
            // Log but don't fail - tools should still be available
            print(
              'VM service initialization failed (this is normal if no Flutter app is running): $e',
            );
          }),
    );

    return result;
  }

  /// Initialize VM service connection asynchronously without blocking
  Future<void> _initializeVMServiceAsync() async {
    try {
      await initializeVMService();
    } catch (e, s) {
      // Log but don't fail - tools should still be available
      print(
        'VM service initialization failed (this is normal if no Flutter app is running): $e',
      );
    }
  }

  @override
  Future<void> shutdown() async {
    await disconnectVMService();
    await super.shutdown();
  }

  /// Create and connect a Flutter Inspector MCP Server
  static Future<FlutterInspectorMCPServer> connect(
    final StreamChannel<String> channel, {
    required final String dartVMHost,
    required final int dartVMPort,
    final bool resourcesSupported = true,
    final bool imagesSupported = false,
    final bool dumpsSupported = false,
    final String logLevel = 'critical',
    final String environment = 'production',
  }) async {
    final server = FlutterInspectorMCPServer.fromStreamChannel(
      channel,
      vmHost: dartVMHost,
      vmPort: dartVMPort,
      enableResources: resourcesSupported,
      enableImages: imagesSupported,
      dumpsSupported: dumpsSupported,
      logLevel: logLevel,
      environment: environment,
    );

    return server;
  }
}
