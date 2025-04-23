import 'dart:convert';
import 'dart:developer';

import 'package:test_app/error_monitor.dart';

part 'mcp_bridge_extensions.dart';

class McpBridgeBinding with ErrorMonitor, McpBridgeExtensions {
  static final instance = McpBridgeBinding._();
  McpBridgeBinding._();

  void initialize() {
    attachToFlutterError();
    initializeServiceExtension();
  }
}
