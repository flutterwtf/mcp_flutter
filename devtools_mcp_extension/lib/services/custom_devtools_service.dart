// ignore_for_file: avoid_catches_without_on_clauses

import 'dart:convert';

import 'package:devtools_mcp_extension/common_imports.dart';
import 'package:devtools_mcp_extension/core/devtools_core/shared/diagnostics/diagnostics_node.dart';
import 'package:devtools_mcp_extension/core/devtools_core/shared/diagnostics/inspector_service.dart'
    as inspector_service;
import 'package:devtools_mcp_extension/services/error_devtools/error_monitor.dart';
import 'package:devtools_mcp_extension/services/object_group_manager.dart';

// class DevtoolsService {
//   DevtoolsService(this.devtoolsService);
//   final DevtoolsService devtoolsService;
// }

/// Service for analyzing and detecting visual errors in Flutter applications
/// using the VM Service and Widget Inspector.
class CustomDevtoolsService {
  CustomDevtoolsService(this.devtoolsService);
  final DartVmDevtoolsService devtoolsService;
  late final ObjectGroupManager _objectGroupManager;
  late final _flutterErrorMonitor = FlutterErrorMonitor(
    service: devtoolsService,
  );
  Future<void> init() async {
    _objectGroupManager = ObjectGroupManager(
      debugName: 'visual-errors',
      vmService: devtoolsService.serviceManager.service!,
      isolate: devtoolsService.serviceManager.isolateManager.mainIsolate,
    );

    await devtoolsService.callServiceExtension(
      'ext.flutter.inspector.${WidgetInspectorServiceExtensions.structuredErrors.name}',
      {},
    );

    await _flutterErrorMonitor.initialize();
  }

  /// Returns a list of visual errors in the Flutter application.
  /// Each error contains:
  /// - nodeId: The ID of the DiagnosticsNode with the error
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
    final errors = _flutterErrorMonitor.errors;

    print(jsonEncode(errors.map((final e) => e.toString()).toList()));

    // final objectRef = await vmService.getObject(
    //   isolateId,
    //   'RenderFlex#${errors.first.renderFlexId}', // The ID from RenderFlex#f8f6b
    // );
    final group = _objectGroupManager.next;
    final response = await vmService.callServiceExtension(
      'ext.flutter.inspector.'
      '${WidgetInspectorServiceExtensions.setFlexFit.name}',
      isolateId: isolateId,
      args: {
        'objectGroup': group.groupName,
        'isSummaryTree': 'false',
        'withPreviews': 'true',
        'fullDetails': 'true',
      },
    );

    final objectGroupApi = inspector_service.ObjectGroup(
      'visual-errors',
      inspector_service.InspectorService(
        dartVmDevtoolsService: devtoolsService,
      ),
    );

    final rootNodes = RemoteDiagnosticsNode(
      response.json!['result'] as Map<String, Object?>,
      objectGroupApi,
      false,
      null,
    );
    // one of children contains in description correct renderFlexId.
    // so we need to find it and use it as rootNode.
    Future<RemoteDiagnosticsNode?> findNodeWithId(
      final RemoteDiagnosticsNode node,
      final String id,
    ) async {
      if (node.description?.contains(id) ?? false) return node;
      if (!node.hasChildren) return null;
      final children = await node.children ?? [];
      for (final child in children) {
        final found = await findNodeWithId(child, id);
        if (found != null) return found;
      }
      return null;
    }

    final rootNode = await findNodeWithId(rootNodes, errors.first.renderFlexId);

    print(jsonEncode(rootNode?.json));

    return RPCResponse.successMap({'errors': errors});

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
            'isSummaryTree': 'true',
            'withPreviews': 'true',
            'fullDetails': 'false',
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
        print(jsonEncode(rootNode.json));

        // Find all errors in the tree
        // final errors = await _findErrors(rootNode);

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

  /// Gets the diagnostic tree for the current Flutter widget tree.
  /// Returns a [RemoteDiagnosticsNode] representing the root of the tree.
  /// Each node contains:
  /// - description: Description of the widget/element
  /// - children: List of child nodes
  /// - properties: List of diagnostic properties
  /// - style: The style to use when displaying the node
  Future<RPCResponse> getDiagnosticTree({
    final bool isSummaryTree = true,
    final bool withPreviews = false,
    final bool fullDetails = false,
  }) async {
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
        // Use the appropriate extension based on parameters
        final extensionMethod =
            isSummaryTree
                ? withPreviews
                    ? WidgetInspectorServiceExtensions
                        .getRootWidgetSummaryTreeWithPreviews
                    : WidgetInspectorServiceExtensions.getRootWidgetSummaryTree
                : WidgetInspectorServiceExtensions.getRootWidgetTree;

        final response = await vmService.callServiceExtension(
          'ext.flutter.inspector.${extensionMethod.name}',
          isolateId: isolateId,
          args: {
            'objectGroup': group.groupName,
            if (withPreviews) 'includeProperties': 'true',
            if (fullDetails) 'subtreeDepth': '-1',
          },
        );

        if (response.json == null || response.json!['result'] == null) {
          await _objectGroupManager.cancelNext();
          return RPCResponse.error('Root widget tree not available');
        }

        // Parse the root node
        final rootNode = RemoteDiagnosticsNode(
          response.json!['result'] as Map<String, Object?>,
          null, // objectGroupApi not needed for tree viewing
          false, // not a property
          null, // no parent
        );

        // Promote the group after successful operation
        await _objectGroupManager.promoteNext();

        return RPCResponse.successMap({
          'root': rootNode.json,
          'groupName': group.groupName,
        });
      } catch (e, stack) {
        // Cancel the group on error
        await _objectGroupManager.cancelNext();
        return RPCResponse.error('Error getting diagnostic tree: $e', stack);
      }
    } catch (e, stack) {
      return RPCResponse.error('Error creating object group: $e', stack);
    }
  }

  // final layoutExplorerNode = await vmService.callServiceExtension(
  //   'ext.flutter.inspector.${WidgetInspectorServiceExtensions.getLayoutExplorerNode.name}',
  //   isolateId: isolateId,
  //   args: {
  //     'objectGroup': group.groupName,
  //     'id': rootNode.valueRef.id,
  //     'subtreeDepth': '-1',
  //   },
  // );

  /// Gets detailed information about a specific node in the diagnostic tree.
  /// [nodeId] is the ID of the node to get details for
  /// [groupName] is the name of the object group that contains the node
  /// Returns detailed information about the node including:
  /// - All diagnostic properties
  /// - Widget type information
  /// - Creation location if available
  Future<RPCResponse> getNodeDetails(
    final String nodeId,
    final String groupName,
  ) async {
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
      // First get the properties for the node
      final propertiesResponse = await vmService.callServiceExtension(
        'ext.flutter.inspector.${WidgetInspectorServiceExtensions.getProperties.name}',
        isolateId: isolateId,
        args: {'arg': nodeId, 'objectGroup': groupName},
      );

      if (propertiesResponse.json == null ||
          propertiesResponse.json!['result'] == null) {
        return RPCResponse.error('Node properties not available');
      }

      // Parse the properties
      final List<Object?> propertiesList =
          propertiesResponse.json!['result'] as List<Object?>;
      final properties =
          propertiesList.map((final prop) {
            final propNode = RemoteDiagnosticsNode(
              prop! as Map<String, Object?>,
              null, // objectGroupApi not needed for properties viewing
              true, // this is a property
              null, // no parent
            );
            return {
              'name': propNode.name,
              'description': propNode.description,
              'value': propNode.valueRef.id,
              'type': propNode.type,
              'level': propNode.level.toString(),
              'propertyType': propNode.propertyType,
              'style': propNode.style.toString(),
            };
          }).toList();

      // Get the parent chain for context
      final parentChainResponse = await vmService.callServiceExtension(
        'ext.flutter.inspector.${WidgetInspectorServiceExtensions.getParentChain.name}',
        isolateId: isolateId,
        args: {'arg': nodeId, 'objectGroup': groupName},
      );

      List<Map<String, Object?>> parentChain = [];
      if (parentChainResponse.json != null &&
          parentChainResponse.json!['result'] != null) {
        final List<Object?> chainList =
            parentChainResponse.json!['result'] as List<Object?>;
        parentChain =
            chainList.map((final node) {
              final parentNode = RemoteDiagnosticsNode(
                node! as Map<String, Object?>,
                null,
                false,
                null,
              );
              return {
                'id': parentNode.valueRef.id,
                'type': parentNode.type,
                'description': parentNode.description,
                'widgetRuntimeType': parentNode.widgetRuntimeType,
              };
            }).toList();
      }

      return RPCResponse.successMap({
        'properties': properties,
        'parentChain': parentChain,
      });
    } catch (e, stack) {
      return RPCResponse.error('Error getting node details: $e', stack);
    }
  }

  /// Gets all children of a specific node in the diagnostic tree.
  /// [nodeId] is the ID of the node to get children for
  /// [groupName] is the name of the object group that contains the node
  /// [isSummaryTree] if true, returns a summarized version of the children
  /// Returns a list of all child nodes with their basic information
  Future<RPCResponse> getNodeChildren(
    final String nodeId,
    final String groupName, {
    final bool isSummaryTree = false,
  }) async {
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
      // Use the appropriate children extension based on isSummaryTree
      final extensionMethod =
          isSummaryTree
              ? WidgetInspectorServiceExtensions.getChildrenSummaryTree
              : WidgetInspectorServiceExtensions.getChildrenDetailsSubtree;

      final response = await vmService.callServiceExtension(
        'ext.flutter.inspector.${extensionMethod.name}',
        isolateId: isolateId,
        args: {'arg': nodeId, 'objectGroup': groupName},
      );

      if (response.json == null || response.json!['result'] == null) {
        return RPCResponse.error('Node children not available');
      }

      // Parse the children
      final List<Object?> childrenList =
          response.json!['result'] as List<Object?>;
      final children =
          childrenList.map((final child) {
            final childNode = RemoteDiagnosticsNode(
              child! as Map<String, Object?>,
              null, // objectGroupApi not needed for children viewing
              false, // not a property
              null, // parent will be set when tree is built
            );
            return {
              'id': childNode.valueRef.id,
              'description': childNode.description,
              'type': childNode.type,
              'style': childNode.style.toString(),
              'hasChildren': childNode.hasChildren,
              'widgetRuntimeType': childNode.widgetRuntimeType,
              'isStateful': childNode.isStateful,
              'isSummaryTree': childNode.isSummaryTree,
            };
          }).toList();

      return RPCResponse.successMap({'children': children});
    } catch (e, stack) {
      return RPCResponse.error('Error getting node children: $e', stack);
    }
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
