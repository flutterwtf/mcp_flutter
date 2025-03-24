// ignore_for_file: unnecessary_async, avoid_catches_without_on_clauses

import 'dart:convert';

import 'package:devtools_mcp_extension/common_imports.dart';
import 'package:devtools_mcp_extension/services/image_compressor.dart';
import 'package:mcp_dart_forwarding_client/mcp_dart_forwarding_client.dart';

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
      ..registerMethod('$flutterInspectorName.getRootWidget', (
        final data,
      ) async {
        print('Handler called: getRootWidget with data: $data');
        final result = await devtoolsService.getRootWidget();
        print('getRootWidget result: ${jsonEncode(result).substring(0, 50)}');
        return result;
      })
      ..registerMethod('$flutterInspectorName.screenshot', (final data) async {
        print('Handler called: screenshot with data: $data');
        try {
          final screenshot = await devtoolsService.takeScreenshot(data);
          final base64Image = screenshot.data;
          var compressedScreenshot = '';
          // Print response info without the full data
          if (base64Image != null) {
            compressedScreenshot = await ImageCompressor.compressBase64Image(
              base64Image: base64Image,
            );
            print(
              'Screenshot result - error: ${screenshot.error} '
              'success: ${screenshot.success} data length: ${compressedScreenshot.length}',
            );
          } else {
            print(
              'Screenshot result - error: ${screenshot.error} '
              'success: ${screenshot.success} data: null',
            );
          }

          // Test sending a smaller response to verify communication
          if (!forwardingClient.isConnected()) {
            print('WARNING: Client disconnected, cannot send response');
            return RPCResponse.error('Client disconnected');
          }

          print('Returning screenshot response');
          return compressedScreenshot;
        } catch (e, st) {
          print('Error taking screenshot: $e');
          print('Stack trace: $st');
          return RPCResponse.error('Error taking screenshot: $e');
        }
      });

    for (final extension in freelyForwardingExtensions) {
      forwardingClient.registerMethod(extension, (final data) async {
        print('Handler called: $extension with data: $data');
        final result = await devtoolsService.callServiceExtension(
          extension,
          data,
        );
        return result;
      });
    }

    print('Registered all method handlers');
  }
}
