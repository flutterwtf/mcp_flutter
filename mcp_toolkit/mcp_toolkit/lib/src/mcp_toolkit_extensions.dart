// ignore_for_file: prefer_asserts_with_message, lines_longer_than_80_chars

import 'package:flutter/foundation.dart';

import 'mcp_models.dart';
import 'mcp_toolkit_binding_base.dart';
import 'services/error_monitor.dart';

/// A mixin that adds MCP Toolkit extensions to a binding.
mixin MCPToolkitExtensions on MCPToolkitBindingBase {
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
  void initializeServiceExtensions({
    required final ErrorMonitor errorMonitor,
    required final Set<MCPCallEntry> entries,
  }) {
    assert(!_debugServiceExtensionsRegistered);
    if (kReleaseMode) {
      throw UnsupportedError(
        'MCP Toolkit entries should only be added in debug mode',
      );
    }
    assert(() {
      // Register individual service extensions for each entry
      for (final entry in entries) {
        registerServiceExtension(
          name: entry.key,
          callback: (final parameters) async => entry.value.handler(parameters),
        );
      }

      // Register the registerDynamics service extension
      registerServiceExtension(
        name: 'registerDynamics',
        callback: (final parameters) async => _handleRegisterDynamics(entries),
      );

      return true;
    }());
    assert(() {
      _debugServiceExtensionsRegistered = true;
      return true;
    }());
  }

  /// Handles the registerDynamics service extension call
  /// Returns all tools and resources in the format expected by the MCP server
  Map<String, dynamic> _handleRegisterDynamics(
    final Set<MCPCallEntry> entries,
  ) {
    final tools = <Map<String, dynamic>>[];
    final resources = <Map<String, dynamic>>[];

    for (final entry in entries) {
      // Add tool definitions
      if (entry.hasTool) {
        tools.add(Map<String, dynamic>.from(entry.value.toolDefinition!));
      } else {
        // Create a default tool definition for entries without one
        tools.add({
          'name': entry.key,
          'description': 'Flutter app tool: ${entry.key}',
          'inputSchema': {
            'type': 'object',
            'properties': {
              'parameters': {
                'type': 'object',
                'description': 'Parameters for the tool call',
              },
            },
          },
        });
      }

      // Add resource definitions
      if (entry.hasResource) {
        resources.add(
          Map<String, dynamic>.from(entry.value.resourceDefinition!),
        );
      }
    }

    return {
      'tools': tools,
      'resources': resources,
      'appId': 'flutter_app_${DateTime.now().millisecondsSinceEpoch}',
      'registeredAt': DateTime.now().toIso8601String(),
    };
  }
}
