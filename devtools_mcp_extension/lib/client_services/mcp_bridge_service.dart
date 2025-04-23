import 'dart:convert';
import 'dart:developer';

import 'package:devtools_mcp_extension/common_imports.dart';
import 'package:devtools_mcp_extension/services/error_devtools/error_monitor.dart';
import 'package:flutter/foundation.dart';

const _extensionName = 'ext.mcp.bridge.';

class McpBridgeService {
  McpBridgeService._();
  static final instance = McpBridgeService._();
  late final _errorMonitor = FlutterErrorMonitor();
  var _initialized = false;
  Future<void> init() async {
    if (_initialized || !kDebugMode) return;
    await _errorMonitor.initialize();
    _initialized = true;

    registerExtension(
      '${_extensionName}errors',
      (final method, final params) async => ServiceExtensionResponse.result(
        jsonEncode(_errorMonitor.errors.map((final e) => e.toJson()).toList()),
      ),
    );
  }

  Future<void> dispose() async {
    await _errorMonitor.dispose();
    _initialized = false;
  }
}
