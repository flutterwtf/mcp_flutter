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
    this.enableResources = true,
    this.enableImages = false,
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
- test_custom_ext: Test custom extension

Available resources (if enabled):
- visual://localhost/app/errors/latest: Get latest app errors
- visual://localhost/view/details: Get view details  
- visual://localhost/view/screenshots: Get app screenshots
- visual://localhost/view/errors: Get view errors

Connect to a running Flutter app on debug mode to use these features.
          ''',
       );
  final String vmHost;
  final int vmPort;
  final bool enableResources;
  final bool enableImages;

  @override
  FutureOr<InitializeResult> initialize(final InitializeRequest request) async {
    // Initialize VM service connection
    await initializeVMService();

    // Call parent initialize which will trigger the mixin's initialize
    final result = await super.initialize(request);

    return result;
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
  }) async {
    final server = FlutterInspectorMCPServer.fromStreamChannel(
      channel,
      vmHost: dartVMHost,
      vmPort: dartVMPort,
      enableResources: resourcesSupported,
      enableImages: imagesSupported,
    );

    return server;
  }
}
