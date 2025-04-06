import 'package:devtools_mcp_extension/common_imports.dart';
import 'package:devtools_mcp_extension/core/devtools_core/shared/diagnostics/diagnostics_node.dart';
import 'package:devtools_mcp_extension/services/object_group_manager.dart';

/// Service for analyzing and detecting visual errors in Flutter applications
/// using the VM Service and Widget Inspector.
class CustomDevtoolsService {
  CustomDevtoolsService(this.devtoolsService) {
    _objectGroupManager = ObjectGroupManager(
      debugName: 'visual-errors',
      vmService: devtoolsService.serviceManager.service!,
      isolate: devtoolsService.serviceManager.isolateManager.mainIsolate,
    );
  }

  final DevtoolsService devtoolsService;
  late final ObjectGroupManager _objectGroupManager;

  /// Returns a list of visual errors in the Flutter application.
  /// Each error contains:
  /// - nodeId: The ID of the node with the error
  /// - description: Description of the error
  /// - errorType: Type of the error (e.g., "Layout Overflow", "Render Issue")
  Future<RPCResponse> getVisualErrors(final Map<String, dynamic> params) async {
    final serviceManager = devtoolsService.serviceManager;
    if (!serviceManager.connectedState.value.connected) {
      return RPCResponse.error('Not connected to VM service');
    }

    final vmService = serviceManager.service;
    if (vmService == null) {
      return RPCResponse.error('VM service not available');
    }

    final isolateId = serviceManager.isolateManager.mainIsolate.value?.id;
    if (isolateId == null) {
      return RPCResponse.error('No main isolate available');
    }

    try {
      // Get a new object group for this operation
      final group = _objectGroupManager.next;

      try {
        // Get the root widget tree with full details to analyze for errors
        final response = await vmService.callServiceExtension(
          'ext.flutter.inspector.getRootWidgetTree',
          isolateId: isolateId,
          args: {
            'objectGroup': group.groupName,
            'isSummaryTree': 'false',
            'withPreviews': 'false',
            'fullDetails': 'true',
          },
        );

        if (response.json == null || response.json!['result'] == null) {
          await _objectGroupManager.cancelNext();
          return RPCResponse.error('Root widget tree not available');
        }

        // Parse the root node
        final rootNode = RemoteDiagnosticsNode(
          response.json!['result'] as Map<String, Object?>,
          null, // objectGroupApi not needed for error detection
          false, // not a property
          null, // no parent
        );

        // Find all errors in the tree
        final errors = await _findErrors(rootNode);

        // Promote the group after successful operation
        await _objectGroupManager.promoteNext();

        return RPCResponse.successMap({'errors': errors});
      } catch (e) {
        // Cancel the group on error
        await _objectGroupManager.cancelNext();
        rethrow;
      }
    } catch (e, stackTrace) {
      return RPCResponse.error('Error getting visual errors: $e', stackTrace);
    }
  }

  Future<List<Map<String, dynamic>>> _findErrors(
    final RemoteDiagnosticsNode node,
  ) async {
    final errors = <Map<String, dynamic>>[];

    // Check if this node has an error
    if (_isErrorNode(node)) {
      errors.add({
        'nodeId': node.valueRef.id,
        'description': node.description ?? 'Unknown error',
        'errorType': _determineErrorType(node),
      });
    }

    // Recursively check children
    final children = node.childrenNow;
    for (final child in children) {
      errors.addAll(await _findErrors(child));
    }

    return errors;
  }

  bool _isErrorNode(final RemoteDiagnosticsNode node) {
    // Check for error level diagnostics
    if (node.level == DiagnosticLevel.error) {
      return true;
    }

    // Check for common error patterns in descriptions
    final description = node.description?.toLowerCase() ?? '';
    return description.contains('overflow') ||
        description.contains('incorrect use') ||
        description.contains('invalid') ||
        description.contains('error') ||
        description.contains('failed');
  }

  String _determineErrorType(final RemoteDiagnosticsNode node) {
    final description = node.description?.toLowerCase() ?? '';
    if (description.contains('overflow')) {
      return 'Layout Overflow';
    }
    if (description.contains('incorrect use')) {
      return 'Usage Error';
    }
    if (description.contains('invalid')) {
      return 'Invalid State';
    }
    if (description.contains('failed')) {
      return 'Operation Failed';
    }
    return 'General Error';
  }

  /// Cleanup resources when the service is disposed
  Future<void> dispose() async {
    await _objectGroupManager.dispose();
  }
}

class CustomInspector with WidgetInspectorService {
  CustomInspector() : super();

  @override
  void inspect(final Object? object) {
    super.inspect(object);
  }
}
