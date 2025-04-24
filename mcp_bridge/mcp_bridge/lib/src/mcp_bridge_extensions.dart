import 'dart:convert';
import 'dart:developer';

import 'package:flutter/cupertino.dart';

import 'error_monitor.dart';

mixin McpBridgeExtensions {
  void initializeServiceExtension({required final ErrorMonitor errorMonitor}) {
    WidgetsBinding.instance.reg;
    registerExtension('ext.devtools.mcp.extension.apperrors', (
      final method,
      final params,
    ) async {
      try {
        final count = int.tryParse(params['count'] ?? '') ?? 10;
        final reversedErrors = errorMonitor.errors.take(count).toList();

        return ServiceExtensionResponse.result(
          jsonEncode({
            // 'type': '_extensionType',
            'method': method,
            'data': reversedErrors.map((final e) => e.toJson()).toList(),
          }),
        );
      } catch (e, stack) {
        return ServiceExtensionResponse.error(
          ServiceExtensionResponse.extensionError,
          jsonEncode({
            // 'type': '_extensionType',
            'method': method,
            'error': e.toString(),
            'stack': stack.toString(),
          }),
        );
      }
    });
  }
}
