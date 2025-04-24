// ignore_for_file: prefer_asserts_with_message

import 'package:flutter/cupertino.dart';

import 'error_monitor.dart';
import 'mcp_binding_base.dart';

/// A mixin that adds MCP Bridge extensions to a binding.
mixin McpBridgeExtensions on McpBridgeBindingBase {
  var _debugServiceExtensionsRegistered = false;

  /// Called when the binding is initialized, to register service
  /// extensions.
  ///
  /// Bindings that want to expose service extensions should overload
  /// this method to register them using calls to
  /// [registerSignalServiceExtension],
  /// [registerBoolServiceExtension],
  /// [registerNumericServiceExtension], and
  /// [registerServiceExtension] (in increasing order of complexity).
  ///
  /// Implementations of this method must call their superclass
  /// implementation.
  ///
  /// {@macro flutter.foundation.BindingBase.registerServiceExtension}
  ///
  /// See also:
  ///
  ///  * <https://github.com/dart-lang/sdk/blob/main/runtime/vm/service/service.md#rpcs-requests-and-responses>

  @protected
  @mustCallSuper
  void initializeServiceExtension({required final ErrorMonitor errorMonitor}) {
    assert(!_debugServiceExtensionsRegistered);
    // if (!kReleaseMode) {}
    assert(() {
      registerServiceExtension(
        name: 'apperrors',
        callback: (final parameters) async {
          final count = int.tryParse(parameters['count'] ?? '') ?? 10;
          final reversedErrors = errorMonitor.errors.take(count).toList();

          return {
            'errors': reversedErrors.map((final e) => e.toJson()).toList(),
          };
        },
      );
      return true;
    }());
    assert(() {
      _debugServiceExtensionsRegistered = true;
      return true;
    }());
  }
}
