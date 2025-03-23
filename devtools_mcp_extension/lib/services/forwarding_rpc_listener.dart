// ignore_for_file: unnecessary_async

import 'dart:convert';

import 'package:dart_forwarding_client/dart_forwarding_client.dart';
import 'package:devtools_mcp_extension/common_imports.dart';

const flutterInspectorName = 'ext.flutter.inspector';

class ForwardingRpcListener {
  ForwardingRpcListener({
    required this.forwardingClient,
    required this.devtoolsService,
  });

  final ForwardingClient forwardingClient;
  final DevtoolsService devtoolsService;

  void init() {
    print('Initializing ForwardingRpcListener');

    forwardingClient
      ..on('connected', () {
        print('ForwardingClient connected to server');
      })
      ..on('disconnected', () {
        print(' disconnected from server');
      })
      ..on('error', (final error) {
        print('ForwardingClient error: $error');
      })
      // Register methods that need to return responses
      ..registerMethod('$flutterInspectorName.getRootWidgetTree', (
        final data,
      ) async {
        print('Handler called: getRootWidgetTree with data: $data');
        final result = await devtoolsService.getRootWidgetTree();
        print(
          'getRootWidgetTree result: ${jsonEncode(result).substring(0, 50)}',
        );
        return result;
      })
      ..registerMethod('$flutterInspectorName.screenshot', (final data) async {
        print('Handler called: screenshot with data: $data');
        try {
          final screenshot = await devtoolsService.takeScreenshot(data);

          // Print response info without the full data
          if (screenshot.data != null && screenshot.data is String) {
            final String dataStr = screenshot.data as String;
            print(
              'Screenshot result - error: ${screenshot.error} success: ${screenshot.success} data length: ${dataStr.length}',
            );
          } else {
            print(
              'Screenshot result - error: ${screenshot.error} success: ${screenshot.success} data: null',
            );
          }

          // Test sending a smaller response to verify communication
          if (!forwardingClient.isConnected()) {
            print('WARNING: Client disconnected, cannot send response');
            return RPCResponse.error('Client disconnected');
          }

          print('Returning screenshot response');
          return screenshot;
        } catch (e, st) {
          print('Error taking screenshot: $e');
          print('Stack trace: $st');
          return RPCResponse.error('Error taking screenshot: $e');
        }
      });

    print('Registered all method handlers');
  }
}
