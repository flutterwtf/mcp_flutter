// ignore_for_file: prefer_asserts_with_message, lines_longer_than_80_chars

import 'package:flutter/cupertino.dart';

import 'mcp_bridge_binding_base.dart';
import 'mcp_bridge_listeners.dart';
import 'services/error_monitor.dart';

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
  void initializeServiceExtension({
    required final ErrorMonitor errorMonitor,
    required final McpBridgeListeners listeners,
  }) {
    assert(!_debugServiceExtensionsRegistered);

    // if (!kReleaseMode) {}
    assert(() {
      final listenersMap = {
        'apperrors': listeners.onAppErrors,
        'view_screenshots': listeners.onViewScreenshots,
        'view_details': listeners.onViewDetails,
      };

      for (final entry in listenersMap.entries) {
        registerServiceExtension(
          name: entry.key,
          callback: (final parameters) async => entry.value(parameters),
        );
      }

      return true;
    }());
    assert(() {
      _debugServiceExtensionsRegistered = true;
      return true;
    }());
  }
}
