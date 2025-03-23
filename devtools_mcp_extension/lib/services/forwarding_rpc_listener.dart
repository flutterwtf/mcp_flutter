// ignore_for_file: unnecessary_async

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
    // TODO: listen only for flutter inspector events
    forwardingClient
      ..on(
        '$flutterInspectorName.getRootWidgetTree',
        (final data) async => devtoolsService.getRootWidgetTree(),
      )
      ..on(
        '$flutterInspectorName.screenshot',
        (final data) async => devtoolsService.takeScreenshot(data),
      );
  }
}
